import { Form, Input, Modal, Select, message } from 'antd';
import { DEFAULT_ANOMALY_DETECTION } from '@live-auction/shared';

import { useState } from 'react';

import { auctionsApi, liveRoomsApi, lotsApi } from '../../lib/api';

import ImageUrlField from './ImageUrlField';

import AuctionRulesFields from './AuctionRulesFields';



export interface AddLiveProductModalProps {

  open: boolean;

  roomId: string | null;

  nextSortOrder: number;

  onClose: () => void;

  onSuccess: () => void;

}



export default function AddLiveProductModal({

  open,

  roomId,

  nextSortOrder,

  onClose,

  onSuccess,

}: AddLiveProductModalProps) {

  const [form] = Form.useForm();

  const [submitting, setSubmitting] = useState(false);



  const handleFinish = async (values: Record<string, unknown>) => {

    if (!roomId) {

      message.error('请先选择直播专场');

      return;

    }

    setSubmitting(true);

    try {

      const lot = (await lotsApi.create({

        title: values.title,

        description: values.description,

        imageUrl: values.imageUrl,

        category: values.category ?? 'general',

      })) as { id: string };



      await lotsApi.publish(lot.id);



      const auction = (await auctionsApi.create({

        lotId: lot.id,

        title: values.title,

        rules: values.rules,

      })) as { id: string };



      await liveRoomsApi.addAuction(roomId, auction.id, nextSortOrder);



      message.success('商品已添加并加入待上架队列');

      form.resetFields();

      onSuccess();

      onClose();

    } catch (e) {

      message.error(e instanceof Error ? e.message : '添加失败');

    } finally {

      setSubmitting(false);

    }

  };



  return (

    <Modal

      title="添加商品"

      open={open}

      onCancel={onClose}

      onOk={() => form.submit()}

      confirmLoading={submitting}

      width={560}

      destroyOnClose

    >

      <Form

        form={form}

        layout="vertical"

        initialValues={{

          category: 'general',

          rules: {

            startPrice: 100,

            minIncrement: 10,

            durationSeconds: 600,

            capPrice: 5000,

            softClose: {

              enabled: true,

              extensionSeconds: 15,

              triggerWindowSeconds: 30,

              maxTotalExtensionSeconds: 600,

            },

            allowHostCancel: true,
            anomalyDetection: DEFAULT_ANOMALY_DETECTION,
          },

        }}

        onFinish={handleFinish}

      >

        <Form.Item name="title" label="商品名称" rules={[{ required: true }]}>

          <Input placeholder="例：冰种翡翠手镯" />

        </Form.Item>

        <Form.Item name="description" label="商品介绍">

          <Input.TextArea rows={2} placeholder="简要描述" />

        </Form.Item>

        <Form.Item name="imageUrl" label="商品图片">

          <ImageUrlField />

        </Form.Item>

        <Form.Item name="category" label="分类">

          <Select

            options={[

              { value: 'general', label: '通用' },

              { value: 'jewelry', label: '珠宝' },

              { value: 'luxury', label: '奢侈品' },

            ]}

          />

        </Form.Item>

        <AuctionRulesFields />

      </Form>

    </Modal>

  );

}

