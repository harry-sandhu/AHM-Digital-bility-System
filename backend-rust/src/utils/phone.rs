/// backend/src/utils/phoneUtils.ts, ported verbatim.
pub fn normalize_phone(value: &str) -> String {
    value.chars().filter(|c| c.is_ascii_digit()).collect()
}

pub fn is_phone_length_valid(value: &str) -> bool {
    (10..=15).contains(&value.chars().count())
}
