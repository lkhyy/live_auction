import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, List, Modal, Space, message } from 'antd';
import { useState } from 'react';
import { lotsApi } from '../../lib/api';
import AdminLoadError from '../../components/AdminLoadError';
import { useAdminApiReady } from '../../hooks/useAdminApiReady';

type LotRow = Record<string, unknown>;

export default function AdminLotsPage() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<LotRow | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const qc = useQueryClient();

  const apiReady = useAdminApiReady();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['lots', 'mine'],
    queryFn: () => lotsApi.list(true),
    enabled: apiReady,
    retry: 1,
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['lots'] });

  const createMutation = useMutation({
    mutationFn: lotsApi.create,
    onSuccess: () => {
      message.success('商品已创建');
      setOpen(false);
      form.resetFields();
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      lotsApi.update(id, data),
    onSuccess: () => {
      message.success('商品已更新');
      setEditOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: lotsApi.publish,
    onSuccess: () => {
      message.success('已上架');
      invalidate();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const openEdit = (item: LotRow) => {
    setEditing(item);
    editForm.setFieldsValue({
      title: item.title,
      description: item.description,
      category: item.category,
      imageUrl: item.imageUrl,
    });
    setEditOpen(true);
  };

  const canEdit = (status: string) => status === 'DRAFT' || status === 'ACTIVE';

  return (
    <Card
      title="商品管理"
      extra={
        <Button type="primary" onClick={() => setOpen(true)}>
          新建商品
        </Button>
      }
    >
      <AdminLoadError error={isError ? (error as Error) : null} title="商品列表加载失败" />
      <List
        loading={isLoading || !apiReady}
        dataSource={(data as LotRow[]) ?? []}
        renderItem={(item) => (
          <List.Item
            actions={[
              canEdit(item.status as string) && (
                <Button key="edit" onClick={() => openEdit(item)}>
                  编辑
                </Button>
              ),
              item.status === 'DRAFT' && (
                <Button
                  key="pub"
                  type="primary"
                  onClick={() => publishMutation.mutate(item.id as string)}
                >
                  上架
                </Button>
              ),
            ].filter(Boolean)}
          >
            <List.Item.Meta
              title={item.title as string}
              description={
                <Space direction="vertical" size={0}>
                  <span>状态: {item.status as string}</span>
                  <span style={{ color: '#888' }}>{(item.description as string) ?? ''}</span>
                </Space>
              }
            />
          </List.Item>
        )}
      />

      <Modal
        title="新建商品"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="category" label="品类">
            <Input placeholder="jewelry" />
          </Form.Item>
          <Form.Item name="imageUrl" label="图片 URL">
            <Input placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑商品"
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(v) =>
            editing && updateMutation.mutate({ id: editing.id as string, data: v })
          }
        >
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="category" label="品类">
            <Input />
          </Form.Item>
          <Form.Item name="imageUrl" label="图片 URL">
            <Input placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
