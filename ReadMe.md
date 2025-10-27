# Express + React驱动的mcp小demo

需要server下面创建.env文件，需要提供以下信息

```
# 新建的MongoDB cluster，用于云端储存游戏数据
MONGO_URI=mongodb+srv://xxx:xxxx@xxxx/

# openai key
OPENAI_API_KEY=sk-proj-zghereiskey

# model 选择
OPENAI_MODEL=gpt-4o-mini

```

创建好之后，使用以下指令启动( 默认电脑安装了nodejs )

1. npm install

2. npm run dev
