module.exports = {
    apps: [{
        name: 'news-watcher',
        script: 'watcher.js',
        cwd: __dirname,
        autorestart: true,
        max_restarts: 10,
        restart_delay: 5000,
        exp_backoff_restart_delay: 100,
        watch: false,
        max_memory_restart: '200M',
        env: {
            NODE_ENV: 'production'
        },
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        error_file: 'logs/error.log',
        out_file: 'logs/output.log',
        merge_logs: true
    }]
};
