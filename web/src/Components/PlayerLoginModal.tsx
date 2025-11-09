import React, { useState, useEffect } from 'react';
import { Modal, Button, List, Input, Form, Space, message, Avatar } from 'antd';
import { UserOutlined, PlusOutlined, LoginOutlined, EditOutlined } from '@ant-design/icons';
import { useGetPlayersQuery, useCreatePlayerMutation, type Player } from '../Redux/api/gameApi';

interface PlayerLoginModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectPlayer: (player: Player) => void;
    currentPlayer: Player | null;
}

/**
 * 玩家登录/选择 Modal 组件
 * 功能：
 * 1. 显示所有可用的玩家
 * 2. 选择一个玩家进行操控
 * 3. 创建新玩家
 */
const PlayerLoginModal: React.FC<PlayerLoginModalProps> = ({ 
    visible, 
    onClose, 
    onSelectPlayer,
    currentPlayer 
}) => {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [form] = Form.useForm();
    
    // RTK Query hooks
    const { data: playersData, isLoading, refetch } = useGetPlayersQuery();
    const [createPlayer, { isLoading: isCreating }] = useCreatePlayerMutation();

    // 刷新玩家列表
    useEffect(() => {
        if (visible) {
            refetch();
        }
    }, [visible, refetch]);

    // 处理选择玩家
    const handleSelectPlayer = (player: Player) => {
        onSelectPlayer(player);
        message.success(`已切换到玩家：${player.name}`);
        onClose();
    };

    // 处理创建新玩家
    const handleCreatePlayer = async (values: { name: string }) => {
        try {
            const result = await createPlayer({
                name: values.name,
                spawnPosition: { x: 0, y: 50, z: 0 } // 默认出生点
            }).unwrap();
            
            message.success(`玩家 "${result.player.name}" 创建成功！`);
            form.resetFields();
            setShowCreateForm(false);
            onSelectPlayer(result.player);
            onClose();
        } catch (error) {
            const err = error as { data?: { message?: string } };
            message.error(err?.data?.message || '创建玩家失败');
        }
    };

    // 获取玩家等级颜色
    const getLevelColor = (level: number) => {
        if (level >= 10) return '#ff4d4f';
        if (level >= 5) return '#faad14';
        return '#52c41a';
    };

    return (
        <Modal
            title={
                <Space>
                    <UserOutlined />
                    <span>玩家管理</span>
                </Space>
            }
            open={visible}
            onCancel={onClose}
            footer={null}
            width={600}
        >
            {!showCreateForm ? (
                <>
                    <div style={{ marginBottom: 16 }}>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setShowCreateForm(true)}
                            block
                        >
                            创建新玩家
                        </Button>
                    </div>

                    <List
                        loading={isLoading}
                        dataSource={playersData?.players || []}
                        locale={{ emptyText: '暂无玩家，请创建一个新玩家' }}
                        renderItem={(player) => (
                            <List.Item
                                key={player.id}
                                style={{
                                    background: currentPlayer?.id === player.id ? '#f0f7ff' : 'transparent',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    marginBottom: '8px',
                                    border: currentPlayer?.id === player.id ? '2px solid #1890ff' : '1px solid #f0f0f0',
                                }}
                                actions={[
                                    currentPlayer?.id === player.id ? (
                                        <Button
                                            type="text"
                                            icon={<EditOutlined />}
                                            disabled
                                        >
                                            当前玩家
                                        </Button>
                                    ) : (
                                        <Button
                                            type="primary"
                                            icon={<LoginOutlined />}
                                            onClick={() => handleSelectPlayer(player)}
                                        >
                                            切换
                                        </Button>
                                    )
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={
                                        <Avatar
                                            style={{
                                                backgroundColor: getLevelColor(player.attributes.level),
                                            }}
                                            size="large"
                                        >
                                            {player.name.charAt(0).toUpperCase()}
                                        </Avatar>
                                    }
                                    title={
                                        <Space>
                                            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                                                {player.name}
                                            </span>
                                            <span style={{ 
                                                fontSize: '12px', 
                                                color: getLevelColor(player.attributes.level),
                                                fontWeight: 'bold' 
                                            }}>
                                                Lv.{player.attributes.level}
                                            </span>
                                        </Space>
                                    }
                                    description={
                                        <Space direction="vertical" size={0}>
                                            <span>
                                                血量: {player.attributes.health}/{player.attributes.maxHealth}
                                            </span>
                                            <span>
                                                经验: {player.attributes.experience}
                                            </span>
                                            <span style={{ fontSize: '12px', color: '#999' }}>
                                                位置: ({player.position.x.toFixed(1)}, {player.position.y.toFixed(1)}, {player.position.z.toFixed(1)})
                                            </span>
                                        </Space>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                </>
            ) : (
                <div>
                    <Button
                        type="link"
                        onClick={() => {
                            setShowCreateForm(false);
                            form.resetFields();
                        }}
                        style={{ marginBottom: 16, padding: 0 }}
                    >
                        ← 返回玩家列表
                    </Button>

                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleCreatePlayer}
                    >
                        <Form.Item
                            label="玩家名称"
                            name="name"
                            rules={[
                                { required: true, message: '请输入玩家名称' },
                                { min: 2, message: '名称至少2个字符' },
                                { max: 20, message: '名称最多20个字符' },
                            ]}
                        >
                            <Input
                                placeholder="输入玩家名称"
                                prefix={<UserOutlined />}
                                size="large"
                            />
                        </Form.Item>

                        <Form.Item>
                            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                                <Button onClick={() => {
                                    setShowCreateForm(false);
                                    form.resetFields();
                                }}>
                                    取消
                                </Button>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={isCreating}
                                    icon={<PlusOutlined />}
                                >
                                    创建玩家
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </div>
            )}
        </Modal>
    );
};

export default PlayerLoginModal;
