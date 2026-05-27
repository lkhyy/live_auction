import { Upload, Input, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

const MAX_BYTES = 512 * 1024;

interface ImageUrlFieldProps {
  value?: string;
  onChange?: (value: string) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImageUrlField({ value, onChange }: ImageUrlFieldProps) {
  const uploadProps: UploadProps = {
    accept: 'image/*',
    showUploadList: false,
    beforeUpload: async (file) => {
      if (file.size > MAX_BYTES) {
        message.warning('图片不超过 512KB，请使用 URL 或压缩后重试');
        return Upload.LIST_IGNORE;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        onChange?.(dataUrl);
        message.success('图片已选择');
      } catch {
        message.error('图片读取失败');
      }
      return Upload.LIST_IGNORE;
    },
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      <Input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="https://... 或点击下方上传"
      />
      <Upload {...uploadProps}>
        <div
          style={{
            width: 80,
            height: 80,
            border: '1px dashed #d9d9d9',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
            background: '#fafafa',
          }}
        >
          {value ? (
            <img src={value} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <PlusOutlined style={{ fontSize: 20, color: '#999' }} />
          )}
        </div>
      </Upload>
    </Space>
  );
}
