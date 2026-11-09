CODEX_HOME=~/.codex-chatgpt codex app-server --listen unix:///tmp/chatgpt.sock 
CODEX_HOME 绑定 auth.json
CODEX_HOME=~/.codex-shengsuanyun app-server --listen ws://127.0.0.1:8080


要在不影响其他状态的情况下切换 model / modelProvider，应该通过 app-server 的 turn/start（或线程级的 settings-update 机制）只传递 model/modelProvider 字段，其余覆盖字段留空（None/不传），这样后端只会更新这两个字段，其余会继续沿用当前配置。

