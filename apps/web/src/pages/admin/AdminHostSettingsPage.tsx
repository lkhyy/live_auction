import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Descriptions, Form, Input, Modal, Space, message } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MeProfile } from '@live-auction/shared';
import { changePasswordSchema, updateProfileSchema } from '@live-auction/shared';
import AdminLoadError from '../../components/AdminLoadError';
import { useAdminApiReady } from '../../hooks/useAdminApiReady';
import { ApiError, isUnauthorizedError, meApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

const ROLE_LABEL: Record<string, string> = {
  BUYER: '买家',
  HOST: '主播',
  ADMIN: '管理员',
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminHostSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const apiReady = useAdminApiReady();
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);

  const [nameOpen, setNameOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [nameForm] = Form.useForm();
  const [pwdForm] = Form.useForm();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => meApi.profile(),
    enabled: apiReady,
    retry: (count, err) => !isUnauthorizedError(err) && count < 2,
  });

  const profile = data as MeProfile | undefined;

  const updateNameMutation = useMutation({
    mutationFn: (displayName: string) => meApi.updateProfile({ displayName }),
    onSuccess: (updated) => {
      updateUser({
        displayName: updated.displayName,
        email: updated.email,
        role: updated.role,
      });
      void queryClient.invalidateQueries({ queryKey: ['me-profile'] });
      message.success('昵称已更新，用户端直播间将显示新名称');
      setNameOpen(false);
    },
    onError: (err) => {
      message.error(err instanceof ApiError ? err.message : '更新失败');
    },
  });

  const changePwdMutation = useMutation({
    mutationFn: (values: { currentPassword: string; newPassword: string }) =>
      meApi.changePassword(values),
    onSuccess: () => {
      message.success('密码已修改');
      setPwdOpen(false);
      pwdForm.resetFields();
    },
    onError: (err) => {
      message.error(err instanceof ApiError ? err.message : '修改失败');
    },
  });

  const openNameModal = () => {
    nameForm.setFieldsValue({ displayName: profile?.displayName ?? '' });
    setNameOpen(true);
  };

  const onSaveName = async () => {
    const values = await nameForm.validateFields();
    const parsed = updateProfileSchema.safeParse(values);
    if (!parsed.success) {
      message.warning(parsed.error.issues[0]?.message ?? '请检查昵称');
      return;
    }
    updateNameMutation.mutate(parsed.data.displayName);
  };

  const onSavePassword = async () => {
    const values = await pwdForm.validateFields();
    if (values.newPassword !== values.confirmPassword) {
      message.warning('两次输入的新密码不一致');
      return;
    }
    const parsed = changePasswordSchema.safeParse({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    if (!parsed.success) {
      message.warning(parsed.error.issues[0]?.message ?? '请检查密码');
      return;
    }
    changePwdMutation.mutate(parsed.data);
  };

  const onLogout = () => {
    Modal.confirm({
      title: '退出登录',
      content: '确定退出当前账号？',
      onOk: () => {
        logout();
        navigate('/login', { replace: true });
      },
    });
  };

  return (
    <Card title="主播信息">
      <AdminLoadError error={isError ? (error as Error) : null} title="资料加载失败" />

      {isLoading && !isError && <p style={{ color: '#999' }}>加载中…</p>}

      {profile && !isError && (
        <>
          <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="昵称">{profile.displayName}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{profile.email}</Descriptions.Item>
            <Descriptions.Item label="角色">
              {ROLE_LABEL[profile.role] ?? profile.role}
            </Descriptions.Item>
            <Descriptions.Item label="注册时间">
              {formatDate(profile.createdAt)}
            </Descriptions.Item>
          </Descriptions>

          <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
            昵称将展示在用户端直播大厅与橱窗的主播名称处。
          </p>

          <Space wrap>
            <Button onClick={openNameModal}>修改昵称</Button>
            <Button onClick={() => { pwdForm.resetFields(); setPwdOpen(true); }}>
              修改密码
            </Button>
            <Button danger onClick={onLogout}>
              退出登录
            </Button>
          </Space>
        </>
      )}

      <Modal
        title="修改昵称"
        open={nameOpen}
        onCancel={() => setNameOpen(false)}
        onOk={() => void onSaveName()}
        confirmLoading={updateNameMutation.isPending}
        destroyOnClose
      >
        <Form form={nameForm} layout="vertical">
          <Form.Item
            name="displayName"
            label="昵称"
            rules={[{ required: true, message: '请输入昵称' }]}
          >
            <Input placeholder="1–50 个字符" maxLength={50} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改密码"
        open={pwdOpen}
        onCancel={() => setPwdOpen(false)}
        onOk={() => void onSavePassword()}
        confirmLoading={changePwdMutation.isPending}
        destroyOnClose
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item
            name="currentPassword"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="当前密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }]}
          >
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            rules={[{ required: true, message: '请再次输入新密码' }]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
