import { Alert, Button, Card, List, Space, Statistic, Tag, Typography, Input, Modal, Form, message } from "antd";
import { useGetPlayersQuery, useCreatePlayerMutation, useRemovePlayerMutation } from "../Redux/api/gameApi";
import { useState } from "react";
import type { Player } from "../Redux/api/gameApi";

const { Title, Text } = Typography;

const PlayersList = () => {
    const { data, isLoading, isError, error } = useGetPlayersQuery(undefined, {
        pollingInterval: 3000, // 每3秒刷新一次
    });

    const [createPlayer, { isLoading: isCreating }] = useCreatePlayerMutation();
    const [removePlayer] = useRemovePlayerMutation();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form] = Form.useForm();

    const handleCreatePlayer = async (values: { name: string }) => {
        try {
            const result = await createPlayer({ name: values.name }).unwrap();
            message.success(result.message);
            setIsModalOpen(false);
            form.resetFields();
        } catch (err) {
            const error = err as { data?: { message?: string } };
            message.error(error.data?.message || "Failed to create player");
        }
    };

    const handleRemovePlayer = async (playerId: string, playerName: string) => {
        try {
            await removePlayer(playerId).unwrap();
            message.success(`Player "${playerName}" removed`);
        } catch (err) {
            const error = err as { data?: { message?: string } };
            message.error(error.data?.message || "Failed to remove player");
        }
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            idle: "default",
            moving: "blue",
            mining: "orange",
            building: "cyan",
            fighting: "red",
            offline: "default",
        };
        return colors[status] || "default";
    };

    if (isLoading) {
        return (
            <Card>
                <Text>Loading players...</Text>
            </Card>
        );
    }

    if (isError) {
        return (
            <Card>
                <Alert
                    type="error"
                    message="Failed to load players"
                    description={JSON.stringify(error)}
                />
            </Card>
        );
    }

    const players = data?.players || [];

    return (
        <>
            <Card
                title={
                    <Space style={{ width: "100%", justifyContent: "space-between" }}>
                        <Title level={4} style={{ margin: 0 }}>
                            🎮 Online Players
                        </Title>
                        <Button type="primary" onClick={() => setIsModalOpen(true)}>
                            + Add Player
                        </Button>
                    </Space>
                }
            >
                <Statistic
                    title="Total Players"
                    value={data?.count || 0}
                    style={{ marginBottom: 16 }}
                />

                <List
                    dataSource={players}
                    locale={{ emptyText: "No players online. Create one to get started!" }}
                    renderItem={(player: Player) => (
                        <List.Item
                            actions={[
                                <Button
                                    size="small"
                                    danger
                                    onClick={() => handleRemovePlayer(player.id, player.name)}
                                >
                                    Remove
                                </Button>,
                            ]}
                        >
                            <List.Item.Meta
                                title={
                                    <Space>
                                        <Text strong>{player.name}</Text>
                                        <Tag color={getStatusColor(player.status)}>
                                            {player.status}
                                        </Tag>
                                        <Text type="secondary" style={{ fontSize: "12px" }}>
                                            Lv.{player.attributes.level}
                                        </Text>
                                    </Space>
                                }
                                description={
                                    <Space direction="vertical" size="small">
                                        <Space>
                                            <Text type="secondary">Position:</Text>
                                            <Text code>
                                                ({player.position.x.toFixed(1)}, {player.position.y.toFixed(1)}, {player.position.z.toFixed(1)})
                                            </Text>
                                        </Space>
                                        <Space>
                                            <Text type="secondary">Health:</Text>
                                            <Text>{player.attributes.health}/{player.attributes.maxHealth}</Text>
                                        </Space>
                                        <Space>
                                            <Text type="secondary">XP:</Text>
                                            <Text>{player.attributes.experience}</Text>
                                        </Space>
                                    </Space>
                                }
                            />
                        </List.Item>
                    )}
                />
            </Card>

            <Modal
                title="Create New Player"
                open={isModalOpen}
                onCancel={() => {
                    setIsModalOpen(false);
                    form.resetFields();
                }}
                footer={null}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleCreatePlayer}
                    style={{ marginTop: 16 }}
                >
                    <Form.Item
                        name="name"
                        label="Player Name"
                        rules={[
                            { required: true, message: "Please enter a player name" },
                            { max: 50, message: "Name must be 50 characters or less" },
                            {
                                pattern: /^[\w\u4e00-\u9fa5]+$/,
                                message: "Only letters, numbers, underscores, and Chinese characters allowed",
                            },
                        ]}
                    >
                        <Input placeholder="Enter player name" />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit" loading={isCreating}>
                                Create Player
                            </Button>
                            <Button onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default PlayersList;
