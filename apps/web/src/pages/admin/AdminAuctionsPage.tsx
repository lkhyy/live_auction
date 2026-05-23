import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  message,
} from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auctionsApi, lotsApi } from '../../lib/api';

export default function AdminAuctionsPage() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const qc = useQueryClient();

  const { data: auctions, isLoading } = useQuery({
    queryKey: ['auctions', 'admin'],
    queryFn: () => auctionsApi.list(),
  });

  const { data: lots } = useQuery({
    queryKey: ['lots', 'mine'],
    queryFn: () => lotsApi.list(true),
  });

  const createMutation = useMutation({
    mutationFn: auctionsApi.create,
    onSuccess: () => {
      message.success('场次已创建');
      setOpen(false);
      form.resetFields();
      void qc.invalidateQueries({ queryKey: ['auctions'] });
    },
    onError: (e: Error) => message.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      auctionsApi.update(id, data),
    onSuccess: () => {
      message.success('规则已更新');
      setEditOpen(false);
      void qc.invalidateQueries({ queryKey: ['auctions'] });
    },
    onError: (e: Error) => message.error(e.message),
  });

  const goLiveMutation = useMutation({
    mutationFn: auctionsApi.goLive,
    onSuccess: () => {
      message.success('已开播');
      void qc.invalidateQueries({ queryKey: ['auctions'] });
    },
    onError: (e: Error) => message.error(e.message),
  });

  const activeLots =
    ((lots as Array<Record<string, unknown>>) ?? []).filter((l) => l.status === 'ACTIVE');

  return (
    <Card
      title="场次管理"
      extra={
        <Button type="primary" onClick={() => setOpen(true)}>
          创建场次
        </Button>
      }
    >
      <List
        loading={isLoading}
        dataSource={(auctions as Array<Record<string, unknown>>) ?? []}
        renderItem={(item) => (
          <List.Item
            actions={[
              item.status === 'DRAFT' && (
                <>
                  <Button
                    key="edit"
                    onClick={() => {
                      setEditingId(item.id as string);
                      const rules = item.ruleSnapshot as Record<string, unknown>;
                      editForm.setFieldsValue({
                        title: item.title,
                        rules,
                      });
                      setEditOpen(true);
                    }}
                  >
                    改规则
                  </Button>
                  <Button key="live" type="primary" onClick={() => goLiveMutation.mutate(item.id as string)}>
                    开播
                  </Button>
                </>
              ),
              item.status === 'LIVE' && (
                <Link key="room" to={`/m/live/${item.id as string}`}>
                  <Button>进入直播间</Button>
                </Link>
              ),
            ].filter(Boolean)}
          >
            <List.Item.Meta
              title={item.title as string}
              description={`状态: ${item.status as string} | 当前价 ¥${String(item.currentPrice)}`}
            />
          </List.Item>
        )}
      />

      <Modal
        title="创建竞拍场次"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        width={560}
        confirmLoading={createMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            rules: {
              startPrice: 100,
              minIncrement: 10,
              durationSeconds: 300,
              capPrice: 10000,
              softClose: {
                enabled: true,
                extensionSeconds: 15,
                triggerWindowSeconds: 30,
                maxTotalExtensionSeconds: 600,
              },
              allowHostCancel: true,
            },
          }}
          onFinish={(v) => createMutation.mutate(v)}
        >
          <Form.Item name="lotId" label="商品" rules={[{ required: true }]}>
            <Select
              options={activeLots.map((l) => ({
                value: l.id as string,
                label: l.title as string,
              }))}
            />
          </Form.Item>
          <Form.Item name="title" label="场次标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name={['rules', 'startPrice']} label="起拍价">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name={['rules', 'minIncrement']} label="加价幅度">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name={['rules', 'capPrice']} label="封顶价">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name={['rules', 'durationSeconds']} label="时长(秒)">
            <InputNumber min={60} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name={['rules', 'softClose', 'extensionSeconds']} label="延时秒数">
            <Select
              options={[10, 15, 20, 30].map((n) => ({ value: n, label: `${n}秒` }))}
            />
          </Form.Item>
          <Form.Item name={['rules', 'softClose', 'triggerWindowSeconds']} label="触发窗口(秒)">
            <InputNumber min={5} max={120} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改场次规则（仅草稿）"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(v) => editingId && updateMutation.mutate({ id: editingId, data: v })}
        >
          <Form.Item name="title" label="场次标题">
            <Input />
          </Form.Item>
          <Form.Item name={['rules', 'startPrice']} label="起拍价">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name={['rules', 'minIncrement']} label="加价幅度">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name={['rules', 'capPrice']} label="封顶价">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
