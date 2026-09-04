一、codex-bridge.ts 功能增强。 
1、增加sqlite支持，持久化必要的操作内容；
2、增加管理 codex-app-server 的功能， 能使用指定的 CODEX_HOME，--listen 参数启动新的进程，CODEX_HOME不存在则创建. 例如 CODEX_HOME=~/.codex-aws codex app-server --listen ws://127.0.0.1:8080。终止指定的服务，返回正在运行的服务列表。查看指定服务的运行状态。CODEX_HOME=~/.codex-aws 中的 codex-aws 可以作为模型供应商使用，即ThreadStartParams.modelProvider；
3、增加对 codex app-server account/login/start（发起登录）、account/login/cancel（取消）、account/logout（登出）、account/read（查询状态），以及通知 account/login/completed/account/updated 接口的支持，先根据LoginAccountParams.type 中的值作为 CODEX_HOME 启动 app-server 在用这些接口完成登录流程。

二、把 ChatHeader.tsx 中的 <DropdownMenuLabel>Codex Model</DropdownMenuLabel> 拆解并封装成三个独立的组件，三个组件可以在 ChatHeader.tsx 的弹出对话框中调用。也可以在 Sidebar.tsx 的创建新的 thread 页面中调用。
1、模型供应商选择和模型选择组件组件。
2、Reasoning Effort 设置组件。
3、Approval Policy 设置组件。

三、增加 config 组件用于“New Thread” 添加新的设置页面中ConfigToml 的配置。 如果app-server已经在线，则初始化值使用 codex app-server的ConfigManager::read 接口读取。数据结构参考rust源代码 config_toml.rs

四、Sidebar.tsx 的创建新的 thread 按钮 “New Thread” 添加新的设置页面，需要能设置 modelProvider，即 ConfigToml 中的 model_provider 字段，如果没有设置，则回退到 CODEX_HOME=~/.codex-aws 中的 codex-aws ；model；cwd； approvalPolicy； approvalsReviewer； config；serviceName；baseInstructions；developerInstructions； personality； ephemeral； sessionStartSource。 这些设置应用时，需要向 codex-bridge.ts 发送请求， codex-bridge.ts 判断是否需要重新启动一个codex app-server ，如果codex-bridge.ts中的接口返回成功，则把水合后的参数配置写入货更新到 localstorage 并写入 codex-bridge.ts 后端数据库。

