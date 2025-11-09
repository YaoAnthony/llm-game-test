/**
 * 游戏主页面组件
 * 
 * 功能：
 * 1. 显示游戏世界状态（时间、天气、玩家信息）
 * 2. 渲染游戏地图（Canvas 2D）
 * 3. 处理玩家登录和选择
 * 4. 管理 WASD 键盘控制（通过 PlayerController）
 * 5. 实时同步服务器状态（轮询）
 */

import { useEffect, useRef, useCallback } from 'react';
import { Layout, Button, Space, Card, Row, Col, Statistic, Typography, message } from 'antd';
import { UserOutlined, EnvironmentOutlined, ClockCircleOutlined, CloudOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { 
    setLoginModalVisible, 
    setCurrentPlayer,
    setAllPlayers,
    updatePlayerPosition,
    updateWorldState,
    addPlayer,
    removePlayer,
    selectCurrentPlayer,
    selectAllPlayers,
    selectWorldTime,
    selectWeather,
    selectLoginModalVisible,
} from '../../Redux/slices/worldSlice';
import { useGetPlayersQuery, useGetWorldSnapshotQuery, useMovePlayerMutation, type Player } from '../../Redux/api/gameApi';
import PlayerLoginModal from '../../Components/PlayerLoginModal';
import WorldRenderer from '../../Components/WorldRenderer';
import { formatGameTime, getTimeOfDayText, getWeatherText, getTimeProgress } from '../../Utils/gameTime';
import { PlayerController, type MoveCommand } from '../../Utils/PlayerController';
import { useWebSocket } from '../../Context/WebSocketContext';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const GamePage = () => {
    const dispatch = useDispatch();
    
    // WebSocket 连接状态和最新消息
    const { lastMessage } = useWebSocket();
    
    // 本地时间模拟器（用于流畅的时间显示）
    const localTickRef = useRef<number>(0);
    const localTimerRef = useRef<number | null>(null);
    const lastSyncTimeRef = useRef<number>(Date.now());
    
    // 存储 PlayerController 实例，用于 WASD 键盘控制
    const controllerRef = useRef<PlayerController | null>(null);
    
    // 从 Redux store 获取全局状态
    const currentPlayer = useSelector(selectCurrentPlayer);  // 当前控制的玩家
    const allPlayers = useSelector(selectAllPlayers);        // 所有在线玩家
    const worldTime = useSelector(selectWorldTime);          // 游戏世界时间
    const weather = useSelector(selectWeather);              // 天气状况
    const loginModalVisible = useSelector(selectLoginModalVisible); // 登录弹窗是否显示
    
    // RTK Query: 获取所有玩家数据（只在初始加载时使用，不轮询）
    const { data: playersData, isLoading: worldLoading } = useGetPlayersQuery(undefined, {
        refetchOnMountOrArgChange: true,
    });

    // RTK Query: 获取世界数据（包括地图）
    const { data: worldData, isLoading: worldDataLoading, error: worldDataError } = useGetWorldSnapshotQuery(undefined, {
        pollingInterval: 5000, // 每 5 秒刷新一次
    });
    
    // 🐛 调试：检查 API 请求状态
    useEffect(() => {
        console.log('🌍 World data loading:', worldDataLoading);
        console.log('❌ World data error:', worldDataError);
        console.log('📦 World data:', worldData);
    }, [worldDataLoading, worldDataError, worldData]);

    // RTK Query Mutation: 调用移动 API
    const [movePlayer] = useMovePlayerMutation();
    
    // 用 ref 记录是否已经初始化过控制器（避免重复初始化）
    const hasInitializedController = useRef(false);

    /**
     * 处理玩家选择逻辑
     * 
     * 职责：
     * 1. 更新 Redux store 中的当前玩家
     * 2. 创建 PlayerController 实例并激活键盘监听
     * 3. 设置移动回调函数（调用 movePlayer API）
     * 
     * 注意：使用 useCallback 避免每次渲染都重新创建函数
     */
    const handleSelectPlayer = useCallback((player: Player) => {
        console.log(`🎮 Selecting player:`, player);
        dispatch(setCurrentPlayer(player));
        hasInitializedController.current = true; // 标记已初始化，防止重复加载
        
        // 如果已有控制器，先停用（切换玩家时）
        if (controllerRef.current) {
            console.log(`⚠️ Deactivating previous controller`);
            controllerRef.current.deactivate();
        }
        
        console.log(`🔧 Creating new PlayerController for player: ${player.id}`);
        
        /**
         * 移动回调函数
         * 
         * 当 PlayerController 检测到 WASD 按键并决定移动时调用此函数
         * 将移动指令发送到服务器
         * 
         * 关键：使用闭包捕获 player 对象，避免使用 Redux state（会导致重复渲染）
         */
        const moveCallback = async (command: MoveCommand) => {
            console.log(`🚀 [CALLBACK] moveCallback called with:`, command);
            console.log(`👤 [CALLBACK] Current player ID: ${player.id}, name: ${player.name}`);

            try {
                console.log(`📤 [CALLBACK] Calling movePlayer API...`);
                // 调用 RTK Query mutation，发送移动请求到服务器
                const result = await movePlayer({
                    playerId: player.id, // 使用闭包中的 player.id（不依赖 Redux）
                    direction: command.direction,
                    distance: command.distance,
                }).unwrap();

                console.log(`✅ [CALLBACK] Move API returned success:`, result);
                console.log(`✅ [CALLBACK] New position:`, result.player.position);
                
                // ✅ 立即更新 Redux 中的玩家位置
                console.log(`🔄 [CALLBACK] Dispatching setCurrentPlayer...`);
                dispatch(setCurrentPlayer(result.player));
                console.log(`✅ [CALLBACK] Redux state updated`);
            } catch (error) {
                console.error('❌ [CALLBACK] 移动失败:', error);
                console.error('❌ [CALLBACK] Error details:', JSON.stringify(error, null, 2));
            }
        };
        
        // 创建 PlayerController 实例（简化版本）
        const controller = new PlayerController(
            player.id,
            moveCallback
        );
        
        console.log(`▶️ Activating controller...`);
        controller.activate(); // 激活：添加键盘事件监听器，启动游戏循环
        controllerRef.current = controller;
        
        console.log(`✅ Controller initialized and activated`);
        message.success(`🎮 已载入玩家 ${player.name}，使用 WASD 控制移动`);
    }, [dispatch, movePlayer]);

    /**
     * Effect 1: 处理 WebSocket 实时消息
     * 
     * 监听不同类型的 WebSocket 消息并更新 Redux state
     */
    useEffect(() => {
        if (!lastMessage) return;

        console.log(`📨 [WS] Received message type: ${lastMessage.type}`);

        switch (lastMessage.type) {
            case 'player_move': {
                // 玩家移动事件
                const { player } = lastMessage.data;
                console.log(`🏃 [WS] Player moved: ${player.id} to`, player.position);
                
                dispatch(updatePlayerPosition({
                    playerId: player.id,
                    position: player.position,
                }));
                break;
            }

            case 'player_join': {
                // 新玩家加入
                const player = lastMessage.data;
                console.log(`👋 [WS] Player joined: ${player.id} (${player.name})`);
                
                dispatch(addPlayer(player));
                message.info(`玩家 ${player.name} 加入了游戏`);
                break;
            }

            case 'player_leave': {
                // 玩家离开
                const { playerId } = lastMessage.data;
                console.log(`👋 [WS] Player left: ${playerId}`);
                
                dispatch(removePlayer(playerId));
                break;
            }

            case 'time_sync': {
                // 时间同步事件（每 30 秒一次）
                const syncData = lastMessage.data;
                console.log(`⏰ [TIME_SYNC] Received time sync from server: tick ${syncData.tick}, ${syncData.timeOfDay}`);
                console.log(`⏰ [TIME_SYNC] Local tick before sync: ${localTickRef.current}`);
                console.log(`⏰ [TIME_SYNC] Time since last sync: ${((Date.now() - lastSyncTimeRef.current) / 1000).toFixed(1)}s`);
                
                // 更新本地计时器
                localTickRef.current = syncData.tick;
                lastSyncTimeRef.current = Date.now();
                
                // 同步到 Redux（立即更新 UI）
                dispatch(updateWorldState({
                    worldId: 'default-world',
                    time: {
                        tick: syncData.tick,
                        timeOfDay: syncData.timeOfDay,
                        speedMultiplier: syncData.speedMultiplier,
                        tickIntervalMs: syncData.tickIntervalMs,
                        isRunning: true,
                    },
                    weather: {
                        current: syncData.weather,
                        description: syncData.weather,
                    },
                    meta: {
                        autoSaveIntervalMs: 60000,
                    },
                }));
                
                console.log(`✅ [TIME_SYNC] Local time synchronized to tick ${syncData.tick}`);
                break;
            }

            case 'world_update': {
                // 世界状态更新（不更新时间，时间由本地计时器模拟）
                // 只更新天气等非时间信息
                // console.log('🌍 [WS] World update:', lastMessage.data);
                break;
            }

            case 'system': {
                console.log('ℹ️ [WS] System message:', lastMessage.data);
                break;
            }
        }
    }, [lastMessage, dispatch]);

    /**
     * Effect 2: 初始化所有玩家到 Redux
     * 
     * 从 API 获取所有玩家并存入 Redux
     */
    useEffect(() => {
        if (playersData?.players) {
            console.log(`👥 [INIT] Loading ${playersData.players.length} players into Redux`);
            dispatch(setAllPlayers(playersData.players));
        }
    }, [playersData, dispatch]);

    /**
     * Effect 3: 本地时间模拟器
     * 
     * 每 50ms 增加本地 tick，模拟流畅的时间流动
     * 每 30 秒会收到服务器的时间同步进行校准
     */
    useEffect(() => {
        console.log('⏰ [LOCAL_TIMER] Starting local time simulator');
        
        // 启动本地计时器
        localTimerRef.current = window.setInterval(() => {
            localTickRef.current += 1;
            
            // 每秒打印一次（20 ticks = 1 秒）
            if (localTickRef.current % 20 === 0) {
                console.log(`⏰ [LOCAL_TIMER] Local tick: ${localTickRef.current}`);
            }
            
            // 更新 Redux（触发 UI 重绘）
            dispatch(updateWorldState({
                worldId: 'default-world',
                time: {
                    tick: localTickRef.current,
                    timeOfDay: worldTime.timeOfDay, // 保持当前时间段
                    speedMultiplier: 1,
                    tickIntervalMs: 50,
                    isRunning: true,
                },
                weather: {
                    current: weather.current,
                    description: weather.description,
                },
                meta: {
                    autoSaveIntervalMs: 60000,
                },
            }));
        }, 50); // 50ms = 20 TPS
        
        return () => {
            console.log('⏰ [LOCAL_TIMER] Stopping local time simulator');
            if (localTimerRef.current) {
                clearInterval(localTimerRef.current);
                localTimerRef.current = null;
            }
        };
    }, [dispatch, worldTime.timeOfDay, weather]);

    /**
     * Effect 4: 自动加载上次登录的玩家
     * 
     * 功能：
     * 1. 从 localStorage 读取上次选择的玩家 ID
     * 2. 在玩家列表中查找该玩家
     * 3. 自动调用 handleSelectPlayer 初始化控制器
     * 
     * 优化：
     * - 使用 hasInitializedController ref 确保只执行一次
     * - 移除 currentPlayer 依赖，避免 Redux 轮询更新触发重复初始化
     */
    useEffect(() => {
        const savedPlayerId = localStorage.getItem('currentPlayerId');
        
        // 如果已经初始化过控制器，跳过（避免重复初始化）
        if (hasInitializedController.current) {
            return;
        }
        
        console.log(`🔍 Checking for saved player ID:`, savedPlayerId);
        
        if (savedPlayerId && playersData?.players) {
            const player = playersData.players.find((p: Player) => p.id === savedPlayerId);
            if (player) {
                console.log(`✅ Found saved player, auto-loading:`, player);
                handleSelectPlayer(player);
            } else {
                console.log(`⚠️ Saved player ID not found in current players list`);
            }
        }
    }, [playersData, handleSelectPlayer]);

    /**
     * Effect 5: 组件卸载时清理
     * 
     * 停用 PlayerController，移除键盘事件监听器，停止游戏循环
     */
    useEffect(() => {
        return () => {
            if (controllerRef.current) {
                controllerRef.current.deactivate();
            }
        };
    }, []);

    // 计算时间进度（0-1），用于 WorldRenderer 的昼夜循环光照效果
    const timeProgress = getTimeProgress(worldTime.tick, worldTime.tickIntervalMs);

    // ✅ 使用真实的地图数据（从服务器获取）
    const worldTiles = worldData?.map?.tiles;
    
    // 🐛 调试：检查数据是否加载
    useEffect(() => {
        if (worldData) {
            console.log('📦 World data received:', worldData);
            console.log('🗺️  Map data:', worldData.map);
            console.log('🎨 Tiles data:', worldData.map?.tiles);
            console.log('📏 Tiles array length:', worldData.map?.tiles?.length);
            if (worldData.map?.tiles?.[0]) {
                console.log('📐 First row length:', worldData.map.tiles[0].length);
                console.log('🎯 Sample tile:', worldData.map.tiles[0][0]);
            }
        } else {
            console.log('⚠️  World data is undefined');
        }
    }, [worldData]);

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            {/* 顶部导航栏 */}
            <Header style={{ 
                background: '#001529', 
                padding: '0 24px', 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <Title level={3} style={{ color: 'white', margin: 0 }}>
                    多人游戏世界
                </Title>
                
                <Space>
                    {/* 登录/选择玩家按钮 */}
                    <Button
                        type="primary"
                        icon={<UserOutlined />}
                        onClick={() => dispatch(setLoginModalVisible(true))}
                    >
                        {currentPlayer ? `${currentPlayer.name} (Lv.${currentPlayer.attributes.level})` : '登录/选择玩家'}
                    </Button>
                </Space>
            </Header>

            <Content style={{ padding: '24px' }}>
                {/* 游戏信息统计卡片 */}
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    {/* 游戏时间卡片 */}
                    <Col xs={24} sm={12} md={6}>
                        <Card>
                            <Statistic
                                title="游戏时间"
                                value={formatGameTime(worldTime.tick, worldTime.tickIntervalMs)}
                                prefix={<ClockCircleOutlined />}
                                valueStyle={{ fontSize: '18px' }}
                            />
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                {getTimeOfDayText(worldTime.timeOfDay)}
                            </Text>
                        </Card>
                    </Col>
                    
                    {/* 天气状况卡片 */}
                    <Col xs={24} sm={12} md={6}>
                        <Card>
                            <Statistic
                                title="天气状况"
                                value={getWeatherText(weather.current)}
                                prefix={<CloudOutlined />}
                                valueStyle={{ fontSize: '18px' }}
                            />
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                {weather.description}
                            </Text>
                        </Card>
                    </Col>

                    {/* 玩家信息卡片（仅在有玩家时显示） */}
                    {currentPlayer && (
                        <>
                            {/* 生命值卡片 */}
                            <Col xs={24} sm={12} md={6}>
                                <Card>
                                    <Statistic
                                        title="生命值"
                                        value={currentPlayer.attributes.health}
                                        suffix={`/ ${currentPlayer.attributes.maxHealth}`}
                                        valueStyle={{ color: '#cf1322', fontSize: '18px' }}
                                    />
                                </Card>
                            </Col>
                            
                            {/* 位置卡片 */}
                            <Col xs={24} sm={12} md={6}>
                                <Card>
                                    <Statistic
                                        title="当前位置"
                                        value={`(${currentPlayer.position.x.toFixed(0)}, ${currentPlayer.position.z.toFixed(0)})`}
                                        prefix={<EnvironmentOutlined />}
                                        valueStyle={{ fontSize: '16px' }}
                                    />
                                </Card>
                            </Col>
                        </>
                    )}
                </Row>

                {/* 游戏世界渲染区域 */}
                <Card 
                    title="游戏世界" 
                    loading={worldLoading}
                    style={{ marginBottom: 16 }}
                >
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <WorldRenderer
                            width={800}
                            height={600}
                            tiles={worldTiles}
                            players={Object.values(allPlayers)}
                            currentPlayerId={currentPlayer?.id}
                            timeProgress={timeProgress}
                        />
                    </div>
                </Card>

                {/* 未登录提示 */}
                {!currentPlayer && (
                    <Card>
                        <Text type="secondary">
                            👋 欢迎！请点击右上角的"登录/选择玩家"按钮开始游戏
                        </Text>
                    </Card>
                )}
                
                {/* 控制说明 */}
                {currentPlayer && (
                    <Card>
                        <Text type="secondary">
                            🎮 使用 <Text strong>W A S D</Text> 键控制角色移动
                            <br />
                            W - 向上 | S - 向下 | A - 向左 | D - 向右
                        </Text>
                    </Card>
                )}
            </Content>

            {/* 登录/选择玩家弹窗 */}
            <PlayerLoginModal
                visible={loginModalVisible}
                onClose={() => dispatch(setLoginModalVisible(false))}
                onSelectPlayer={handleSelectPlayer}
                currentPlayer={currentPlayer}
            />
        </Layout>
    );
};

export default GamePage;
