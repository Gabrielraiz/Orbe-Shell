// Orbe Shell — backend nativo (Tauri 2 / Rust)
//
// Arquitetura modular: cada comando é uma capacidade isolada. Falhas em um
// componente não derrubam o shell (Orbe Continuity cuida da recuperação no
// frontend; aqui o foco é nunca travar: todos os comandos retornam Result).

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec!["--hidden"]),
            ),
        )
        .manage(commands::system::PerfState::default())
        .invoke_handler(tauri::generate_handler![
            commands::system::sys_info,
            commands::system::battery_info,
            commands::system::perf_stats,
            commands::processes::list_processes,
            commands::processes::end_process,
            commands::apps::app_catalog,
            commands::apps::launch_app,
            commands::apps::resolve_shortcut,
            commands::fs::read_dir_entries,
            commands::fs::read_text_file,
            commands::fs::write_text_file,
            commands::fs::delete_entry,
            commands::wallpaper::current_wallpaper,
            commands::wallpaper::set_wallpaper,
            commands::shell::set_explorer_fallback,
            commands::shell::get_explorer_fallback,
            commands::audio::audio_state,
            commands::audio::audio_set_volume,
            commands::audio::audio_toggle_mute,
            commands::update::check_latest_version,
            commands::update::download_and_run_installer,
            commands::lock_workstation,
        ])
        .run(tauri::generate_context!())
        .expect("erro fatal ao iniciar Orbe Shell");
}
