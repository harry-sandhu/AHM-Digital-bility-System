use crate::models::{
    bilty::ConsignmentNoOnly,
    number_range::NumberRange,
};
use futures_util::TryStreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId, Document},
    Database,
};
use std::collections::HashSet;

pub const NO_CONSIGNMENT_NUMBERS_ERROR: &str = "No consignment numbers available. Contact admin.";

pub enum AllocationError {
    NoNumbersAvailable,
    Database(mongodb::error::Error),
}

impl From<mongodb::error::Error> for AllocationError {
    fn from(err: mongodb::error::Error) -> Self {
        AllocationError::Database(err)
    }
}

/// `findAvailableRanges` — personal ranges (oldest first) always tried
/// before master ranges (oldest first), regardless of relative age between
/// the two groups.
async fn find_available_ranges(
    db: &Database,
    user_id: ObjectId,
) -> mongodb::error::Result<Vec<NumberRange>> {
    let personal_cursor = db
        .collection::<NumberRange>("numberranges")
        .find(doc! { "scope": "personal", "userId": user_id, "isActive": true })
        .sort(doc! { "createdAt": 1 })
        .await?;
    let mut ranges: Vec<NumberRange> = personal_cursor.try_collect().await?;

    let master_cursor = db
        .collection::<NumberRange>("numberranges")
        .find(doc! { "scope": "master", "isActive": true })
        .sort(doc! { "createdAt": 1 })
        .await?;
    let master: Vec<NumberRange> = master_cursor.try_collect().await?;

    ranges.extend(master);
    Ok(ranges)
}

async fn get_used_numbers(
    db: &Database,
    range_start: i64,
    range_end: i64,
) -> mongodb::error::Result<HashSet<i64>> {
    let cursor = db
        .collection::<ConsignmentNoOnly>("bilties")
        .find(doc! { "consignmentNo": { "$gte": range_start, "$lte": range_end } })
        .projection(doc! { "consignmentNo": 1 })
        .await?;

    let records: Vec<ConsignmentNoOnly> = cursor.try_collect().await?;
    Ok(records.into_iter().filter_map(|r| r.consignment_no).collect())
}

/// Module 4b optimization: `range.nextNumber` is always a valid lower bound
/// on the true first-free number (the only place it moves backward is
/// `reset_range_to_first_available`, which always recomputes it correctly),
/// so try it directly via a single targeted existence check instead of
/// fetching every used number in the range. Falls back to the Module 4a
/// full-scan behavior whenever the hint is stale or out of bounds — full
/// correctness is preserved either way, this only changes the common case
/// from O(range size) to O(1).
async fn find_candidate(db: &Database, range: &NumberRange) -> mongodb::error::Result<i64> {
    let hinted = range.next_number.max(range.range_start);

    if hinted <= range.range_end {
        let hinted_is_used = db
            .collection::<ConsignmentNoOnly>("bilties")
            .find_one(doc! { "consignmentNo": hinted })
            .await?
            .is_some();

        if !hinted_is_used {
            return Ok(hinted);
        }
    }

    let used_numbers = get_used_numbers(db, range.range_start, range.range_end).await?;
    let mut candidate = range.range_start;
    while candidate <= range.range_end && used_numbers.contains(&candidate) {
        candidate += 1;
    }
    Ok(candidate)
}

/// `allocateConsignmentNumber` (backend/src/utils/numberRange.ts), with the
/// Module 4b candidate-selection optimization above layered in as an
/// isolated diff over the Module 4a faithful port — every other piece
/// (CAS semantics, personal-before-master ordering, fallthrough-to-next-
/// range on a lock loss, the 100-attempt retry loop) is unchanged.
pub async fn allocate_consignment_number(
    db: &Database,
    user_id: ObjectId,
) -> Result<i64, AllocationError> {
    for _attempt in 0..100 {
        let ranges = find_available_ranges(db, user_id).await?;
        if ranges.is_empty() {
            return Err(AllocationError::NoNumbersAvailable);
        }

        for range in ranges {
            let candidate = find_candidate(db, &range).await?;

            if candidate > range.range_end {
                db.collection::<Document>("numberranges")
                    .update_one(
                        doc! { "_id": range.id, "isActive": true },
                        doc! { "$set": { "nextNumber": candidate, "isExhausted": true } },
                    )
                    .await?;
                continue;
            }

            // Optimistic lock on the `nextNumber` value just read — a CAS
            // loss here falls through to the next range in this same
            // attempt (not a retry of this range); only the next outer
            // attempt re-reads this range fresh.
            let result = db
                .collection::<Document>("numberranges")
                .update_one(
                    doc! { "_id": range.id, "nextNumber": range.next_number, "isActive": true },
                    doc! { "$set": { "nextNumber": candidate + 1, "isExhausted": candidate >= range.range_end } },
                )
                .await?;

            if result.matched_count == 1 {
                return Ok(candidate);
            }
        }
    }

    Err(AllocationError::NoNumbersAvailable)
}

/// `resetRangeToFirstAvailable` (backend/src/utils/numberRange.ts) — used
/// by `deleteBilty` to reclaim a freed consignment number. Always does a
/// full rescan (there's no stale hint to seed from here, since the whole
/// point is recomputing `nextNumber` from scratch after a deletion).
pub async fn reset_range_to_first_available(
    db: &Database,
    range_id: ObjectId,
) -> mongodb::error::Result<()> {
    let range = db
        .collection::<NumberRange>("numberranges")
        .find_one(doc! { "_id": range_id })
        .await?;

    let Some(range) = range else {
        return Ok(());
    };

    let used_numbers = get_used_numbers(db, range.range_start, range.range_end).await?;
    let mut next_number = range.range_start;
    while next_number <= range.range_end && used_numbers.contains(&next_number) {
        next_number += 1;
    }

    db.collection::<Document>("numberranges")
        .update_one(
            doc! { "_id": range_id },
            doc! { "$set": { "nextNumber": next_number, "isExhausted": next_number > range.range_end } },
        )
        .await?;

    Ok(())
}
