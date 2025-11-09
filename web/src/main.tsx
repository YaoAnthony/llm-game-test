// import { StrictMode } from "react"; // ⚠️ 暂时注释，避免 WebSocket 重复连接
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "./index.css";
import App from "./App.tsx";
import "antd/dist/reset.css";
import { store } from "./Redux/store";
import { WebSocketProvider } from "./Context/WebSocketContext";

// ✅ WebSocketProvider 放在最外层，避免因 Redux 状态变化而重新渲染
createRoot(document.getElementById("root")!).render(
  <WebSocketProvider>
    <Provider store={store}>
      <App />
    </Provider>
  </WebSocketProvider>,
);
