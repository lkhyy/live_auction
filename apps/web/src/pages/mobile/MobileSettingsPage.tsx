import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Dialog, Form, Input, List, Toast } from 'antd-mobile';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MeProfile } from '@live-auction/shared';
import { changePasswordSchema, updateProfileSchema } from '@live-auction/shared';
import { QueryErrorCard } from '../../components/QueryErrorCard';
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

export default function MobileSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);

  const [nameVisible, setNameVisible] = useState(false);
  const [pwdVisible, setPwdVisible] = useState(false);
  const [nameForm] = Form.useForm();
  const [pwdForm] = Form.useForm();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => meApi.profile(),
    enabled: !!token,
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
      Toast.show({ icon: 'success', content: '昵称已更新' });
      setNameVisible(false);
    },
    onError: (err) => {
      Toast.show({
        icon: 'fail',
        content: err instanceof ApiError ? err.message : '更新失败',
      });
    },
  });

  const changePwdMutation = useMutation({
    mutationFn: (values: { currentPassword: string; newPassword: string }) =>
      meApi.changePassword(values),
    onSuccess: () => {
      Toast.show({ icon: 'success', content: '密码已修改' });
      setPwdVisible(false);
      pwdForm.resetFields();
    },
    onError: (err) => {
      Toast.show({
        icon: 'fail',
        content: err instanceof ApiError ? err.message : '修改失败',
      });
    },
  });

  const openNameDialog = () => {
    nameForm.setFieldsValue({ displayName: profile?.displayName ?? '' });
    setNameVisible(true);
  };

  const openPwdDialog = () => {
    pwdForm.resetFields();
    setPwdVisible(true);
  };

  const onLogout = () => {
    Dialog.confirm({
      content: '确定退出当前账号？',
      onConfirm: () => {
        logout();
        navigate('/login', { replace: true });
      },
    });
  };

  const onSaveName = async () => {
    const values = await nameForm.validateFields();
    const parsed = updateProfileSchema.safeParse(values);
    if (!parsed.success) {
      Toast.show({ content: parsed.error.issues[0]?.message ?? '请检查昵称' });
      return;
    }
    updateNameMutation.mutate(parsed.data.displayName);
  };

  const onSavePassword = async () => {
    const values = await pwdForm.validateFields();
    if (values.newPassword !== values.confirmPassword) {
      Toast.show({ content: '两次输入的新密码不一致' });
      return;
    }
    const parsed = changePasswordSchema.safeParse({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    if (!parsed.success) {
      Toast.show({ content: parsed.error.issues[0]?.message ?? '请检查密码' });
      return;
    }
    changePwdMutation.mutate(parsed.data);
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 12px' }}>我的</h2>

      {isError && <QueryErrorCard error={error} onRetry={() => void refetch()} />}
      {isLoading && !isError && <Card>加载中...</Card>}

      {profile && !isError && (
        <>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              {profile.displayName}
            </div>
            <List style={{ '--border-inner': 'none', '--border-top': 'none', '--border-bottom': 'none' } as React.CSSProperties}>
              <List.Item extra={profile.email}>邮箱</List.Item>
              <List.Item extra={ROLE_LABEL[profile.role] ?? profile.role}>角色</List.Item>
              <List.Item extra={formatDate(profile.createdAt)}>注册时间</List.Item>
            </List>
          </Card>

          <List header="账号设置" style={{ marginBottom: 12 }}>
            <List.Item clickable onClick={openNameDialog} arrow>
              修改昵称
            </List.Item>
            <List.Item clickable onClick={openPwdDialog} arrow>
              修改密码
            </List.Item>
          </List>

          <Button block color="danger" fill="outline" onClick={onLogout}>
            退出登录
          </Button>
        </>
      )}

      <Dialog
        visible={nameVisible}
        title="修改昵称"
        content={
          <Form form={nameForm} layout="vertical">
            <Form.Item
              name="displayName"
              label="昵称"
              rules={[{ required: true, message: '请输入昵称' }]}
            >
              <Input placeholder="1–50 个字符" clearable />
            </Form.Item>
          </Form>
        }
        actions={[
          [
            { key: 'cancel', text: '取消', onClick: () => setNameVisible(false) },
            {
              key: 'save',
              text: '保存',
              bold: true,
              onClick: () => void onSaveName(),
            },
          ],
        ]}
        onClose={() => setNameVisible(false)}
      />

      <Dialog
        visible={pwdVisible}
        title="修改密码"
        content={
          <Form form={pwdForm} layout="vertical">
            <Form.Item
              name="currentPassword"
              label="当前密码"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input type="password" placeholder="当前密码" clearable />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="新密码"
              rules={[{ required: true, message: '请输入新密码' }]}
            >
              <Input type="password" placeholder="至少 6 位" clearable />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="确认新密码"
              rules={[{ required: true, message: '请再次输入新密码' }]}
            >
              <Input type="password" placeholder="再次输入新密码" clearable />
            </Form.Item>
          </Form>
        }
        actions={[
          [
            { key: 'cancel', text: '取消', onClick: () => setPwdVisible(false) },
            {
              key: 'save',
              text: '保存',
              bold: true,
              onClick: () => void onSavePassword(),
            },
          ],
        ]}
        onClose={() => setPwdVisible(false)}
      />
    </div>
  );
}
