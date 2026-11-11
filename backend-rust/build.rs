use std::process::Command;

fn main() {
    // Commit the binary was built from: git if available, else common CI/host variables.
    let from_git = Command::new("git")
        .args(["rev-parse", "--short=7", "HEAD"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());
    let from_env = ["GIT_COMMIT", "GITHUB_SHA", "RENDER_GIT_COMMIT", "SOURCE_COMMIT"]
        .iter()
        .find_map(|k| std::env::var(k).ok().filter(|v| !v.is_empty()))
        .map(|v| v.chars().take(7).collect::<String>());
    let commit = from_git.filter(|s| !s.is_empty()).or(from_env).unwrap_or_else(|| "unknown".into());
    println!("cargo:rustc-env=BUILD_COMMIT={commit}");
    println!("cargo:rerun-if-changed=.git/HEAD");
    println!("cargo:rerun-if-env-changed=GIT_COMMIT");
    println!("cargo:rerun-if-env-changed=GITHUB_SHA");
}
