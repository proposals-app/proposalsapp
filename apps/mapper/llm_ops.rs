use gag::Gag;

/// RAII guard for suppressing stdout/stderr output
/// 
/// This guard suppresses output when created and automatically
/// restores it when dropped (goes out of scope)
pub struct OutputSuppressor {
    _stdout_gag: Option<Gag>,
    _stderr_gag: Option<Gag>,
}

impl OutputSuppressor {
    /// Create a new output suppressor that blocks both stdout and stderr
    pub fn new() -> Self {
        Self {
            _stdout_gag: Gag::stdout().ok(),
            _stderr_gag: Gag::stderr().ok(),
        }
    }
}

