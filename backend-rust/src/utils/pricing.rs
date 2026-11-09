/// Bilty access fee by freight amount. Tiers: up to 20,000 = 200,
/// up to 30,000 = 300, up to 50,000 = 400, above that = 500.
/// (Keep in sync with frontend/src/utils/biltyPricing.ts.)
pub fn get_bilty_access_amount(freight_amount: f64) -> f64 {
    if freight_amount <= 20000.0 {
        200.0
    } else if freight_amount <= 30000.0 {
        300.0
    } else if freight_amount <= 50000.0 {
        400.0
    } else {
        500.0
    }
}

#[cfg(test)]
mod tests {
    use super::get_bilty_access_amount as fee;

    #[test]
    fn tier_boundaries() {
        assert_eq!(fee(1.0), 200.0);
        assert_eq!(fee(20000.0), 200.0);
        assert_eq!(fee(20000.01), 300.0);
        assert_eq!(fee(30000.0), 300.0);
        assert_eq!(fee(40000.0), 400.0);
        assert_eq!(fee(50000.0), 400.0);
        assert_eq!(fee(50001.0), 500.0);
    }
}
