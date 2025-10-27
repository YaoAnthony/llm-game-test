import { useEffect } from "react";
import { useGameStore } from "../store";
import { getState } from "../api";

export default function GameCanvas() {
  const { x, y, setPosition } = useGameStore();

  useEffect(() => {
    getState().then(({ x, y }) => setPosition(x, y));
  }, []);

  return (
    <div className="relative w-80 h-80 border bg-gray-100 mt-6">
      <div
        className="absolute bg-blue-500 w-6 h-6 rounded"
        style={{ left: x * 10, top: y * 10, transition: "0.3s" }}
      />
    </div>
  );
}
