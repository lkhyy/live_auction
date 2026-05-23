import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, List, Modal, message } from 'antd';
import { useState } from 'react';
import { lotsApi } from '../../lib/api';

export default function AdminLotsPage() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['lots', 'mine'],
    queryFn: () => lotsApi.list(true),
  });

  const createMutation = useMutation({
    mutationFn: lotsApi.create,
    onSuccess: () => {
      message.success('商品已创建');
      setOpen(false);
      form.resetFields();
      void qc.invalidateQueries({ queryKey: ['lots'] });
    },
    onError: (e: Error) => message.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: lotsApi.publish,
    onSuccess: () => {
      message.success('已上架');
      void qc.invalidateQueries({ queryKey: ['lots'] });
    },
  });

  return (
    <Card
      title="商品管理"
      extra={
        <Button type="primary" onClick={() => setOpen(true)}>
          新建商品
        </Button>
      }
    >
      <List
        loading={isLoading}
        dataSource={(data as Array<Record<string, unknown>>) ?? []}
        renderItem={(item) => (
          <List.Item
            actions={[
              item.status === 'DRAFT' && (
                <Button
                  key="pub"
                  onClick={() => publishMutation.mutate(item.id as string)}
                >
                  上架
                </Button>
              ),
            ].filter(Boolean)}
          >
            <List.Item.Meta
              title={item.title as string}
              description={`状态: ${item.status as string} | ${(item.description as string) ?? ''}`}
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
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="category" label="品类">
            <Input placeholder="jewelry" />
          </Form.Item>
          <Form.Item name="imageUrl" label="图片 URL">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
