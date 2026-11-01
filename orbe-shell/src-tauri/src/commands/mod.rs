pub mod apps;
pub mod audio;
pub mod fs;
pub mod processes;
pub mod shell;
pub mod system;
pub mod update;
pub mod wallpaper;

use serde::Serialize;

/// Erro uniforme do shell: qualquer falha vira uma mensagem amigável que o
/// frontend pode exibir/registar no Orbe Continuity sem derrubar a UI.
#[derive(Debug)]
pub struct ShellError(pub String);

impl std::fmt::Display for ShellError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<String> for ShellError {
    fn from(s: String) -> Self {
        ShellError(s)
    }
}

impl From<&str> for ShellError {
    fn from(s: &str) -> Self {
        ShellError(s.to_string())
    }
}

impl From<std::io::Error> for ShellError {
    fn from(e: std::io::Error) -> Self {
        ShellError(format!("Erro de sistema: {}", e))
    }
}

// Erros das APIs Win32 (crate `windows`) viram mensagem amigável também.
#[cfg(windows)]
impl From<windows::core::Error> for ShellError {
    fn from(e: windows::core::Error) -> Self {
        ShellError(format!("Erro do Windows: {}", e))
    }
}

impl Serialize for ShellError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.0)
    }
}

pub type R<T> = Result<T, ShellError>;
