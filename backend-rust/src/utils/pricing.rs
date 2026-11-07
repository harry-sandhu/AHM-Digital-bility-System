/// backend/src/utils/biltyPricing.ts, ported verbatim.
pub fn get_bilty_access_amount(freight_amount: f64) -> f64 {
    if freight_amount <= 10000.0 {
        200.0
    } else if freight_amount <= 30000.0 {
        300.0
    } else if freight_amount <= 50000.0 {
        400.0
    } else {
        500.0
    }
}
