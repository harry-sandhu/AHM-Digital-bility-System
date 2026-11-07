use chrono::{DateTime, FixedOffset, TimeZone, Utc};

/// India has no DST, so a fixed +05:30 offset is exact — no tz-database
/// dependency needed (see backend/src/controllers/biltyController.ts's
/// `getIndianMidnightDeadline`).
fn ist_offset() -> FixedOffset {
    FixedOffset::east_opt(5 * 3600 + 30 * 60).expect("fixed IST offset is always valid")
}

/// The end of `from`'s *IST calendar date* (23:59:59.999 IST), returned as
/// the equivalent UTC instant for storage. Converts to IST first to read
/// off the local date — never assumes the server's own local timezone.
pub fn indian_midnight_deadline(from: DateTime<Utc>) -> DateTime<Utc> {
    let ist = ist_offset();
    let local_date = from.with_timezone(&ist).date_naive();
    let end_of_day = local_date.and_hms_milli_opt(23, 59, 59, 999).unwrap();

    ist.from_local_datetime(&end_of_day)
        .single()
        .expect("a fixed offset is never ambiguous")
        .with_timezone(&Utc)
}

/// `isPastDeadline` — a missing deadline is treated as already past
/// (fail-closed: a user who has never paid is not granted access).
pub fn is_past_deadline(deadline: Option<DateTime<Utc>>) -> bool {
    match deadline {
        None => true,
        Some(deadline) => deadline < Utc::now(),
    }
}
