use mongodb::{
    bson::doc,
    options::IndexOptions,
    Client, Database, IndexModel,
};

pub async fn connect(mongo_uri: &str) -> mongodb::error::Result<Database> {
    let client = Client::with_uri_str(mongo_uri).await?;
    let db = client.default_database().unwrap_or_else(|| client.database("bilty"));

    // Fail fast on a bad connection string / unreachable server rather than
    // discovering it on the first request.
    db.run_command(doc! { "ping": 1 }).await?;

    Ok(db)
}

/// Mongoose auto-creates indexes from schema definitions on connect; dropping
/// the ODM removes that implicit backstop, so every index it was providing
/// must be created explicitly here, plus the two new ones flagged by the
/// earlier audit (NumberRange compound index, Bilty.createdBy).
///
/// Collection names below are Mongoose's actual pluralized defaults
/// (verified against the live `mongoose` pluralize helper, not guessed):
/// User -> users, Bilty -> bilties, NumberRange -> numberranges,
/// BiltyCounter -> biltycounters.
pub async fn ensure_indexes(db: &Database) -> mongodb::error::Result<()> {
    let unique = || IndexOptions::builder().unique(true).build();
    let sparse_unique = || IndexOptions::builder().unique(true).sparse(true).build();

    db.collection::<mongodb::bson::Document>("users")
        .create_index(
            IndexModel::builder()
                .keys(doc! { "phone": 1 })
                .options(unique())
                .build(),
        )
        .await?;

    db.collection::<mongodb::bson::Document>("bilties")
        .create_index(
            IndexModel::builder()
                .keys(doc! { "biltyNumber": 1 })
                .options(unique())
                .build(),
        )
        .await?;

    db.collection::<mongodb::bson::Document>("bilties")
        .create_index(
            IndexModel::builder()
                .keys(doc! { "consignmentNo": 1 })
                .options(sparse_unique())
                .build(),
        )
        .await?;

    db.collection::<mongodb::bson::Document>("bilties")
        .create_index(IndexModel::builder().keys(doc! { "createdBy": 1 }).build())
        .await?;

    db.collection::<mongodb::bson::Document>("biltycounters")
        .create_index(
            IndexModel::builder()
                .keys(doc! { "prefix": 1 })
                .options(unique())
                .build(),
        )
        .await?;

    db.collection::<mongodb::bson::Document>("numberranges")
        .create_index(
            IndexModel::builder()
                .keys(doc! { "scope": 1, "userId": 1, "isActive": 1 })
                .build(),
        )
        .await?;

    db.collection::<mongodb::bson::Document>("contacts")
        .create_index(
            IndexModel::builder()
                .keys(doc! { "kind": 1, "userId": 1 })
                .build(),
        )
        .await?;

    db.collection::<mongodb::bson::Document>("contacts")
        .create_index(
            IndexModel::builder()
                .keys(doc! { "kind": 1, "groupId": 1 })
                .build(),
        )
        .await?;

    db.collection::<mongodb::bson::Document>("groups")
        .create_index(
            IndexModel::builder()
                .keys(doc! { "name": 1 })
                .options(unique())
                .build(),
        )
        .await?;

    tracing::info!("database indexes ensured");
    Ok(())
}
