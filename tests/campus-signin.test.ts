import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BridgeRequestInput, BridgeResponse } from '../src/lib/bridge';
import { toWebVpnUrl } from '../src/lib/webvpn';

const bridgeRequest = vi.fn<(input: BridgeRequestInput) => Promise<BridgeResponse>>();

vi.mock('../src/lib/bridge', () => ({
  bridgeRequest,
  clearNativeSession: vi.fn(async () => {}),
  openOfficialAuth: vi.fn(async () => ({ success: true, url: '', cancelled: false })),
}));

const { CampusService } = await import('../src/services/campus');

function response(url: string, body: string, status = 200): BridgeResponse {
  return { url, body, status, contentType: 'application/json' };
}

describe('classroom sign-in transport', () => {
  beforeEach(() => {
    bridgeRequest.mockReset();
  });

  it('falls back to WebVPN when the direct classroom ports time out', async () => {
    bridgeRequest.mockImplementation(async (input) => {
      if (input.url === 'https://iclass.buaa.edu.cn:8346/?type=jumpMyCenter') {
        throw new Error('timeout');
      }
      if (input.url === toWebVpnUrl('https://iclass.buaa.edu.cn:8346/?type=jumpMyCenter')) {
        return response(
          'https://d.buaa.edu.cn/https-8346/example/?loginName=encoded-user#/MyCenter',
          '',
        );
      }
      if (input.url.includes('/app/user/login.action')) {
        return response(input.url, JSON.stringify({
          STATUS: '0',
          result: { id: 'user-id', sessionId: 'session-id' },
        }));
      }
      if (input.url.includes('/app/common/get_timestamp.action')) {
        return response(input.url, JSON.stringify({ STATUS: '0', timestamp: '1234567890' }));
      }
      if (input.url.includes('/app/course/get_stu_course_sched.action')) {
        expect(input.headers?.sessionId).toBe('session-id');
        expect(input.url).toContain('id=user-id');
        return response(input.url, JSON.stringify({
          STATUS: '0',
          result: [
            {
              id: 'course-schedule-id',
              courseName: '示例课程',
              classBeginTime: '08:00',
              classEndTime: '09:35',
              signStatus: '0',
            },
          ],
        }));
      }
      throw new Error(`Unexpected request: ${input.url}`);
    });

    const service = new CampusService();
    service.mode = 'direct';
    const classes = await service.loadSignins();

    expect(classes).toEqual([
      {
        courseId: 'course-schedule-id',
        courseName: '示例课程',
        beginTime: '08:00',
        endTime: '09:35',
        status: 0,
      },
    ]);
  });

  it('surfaces classroom service errors instead of returning an empty list', async () => {
    bridgeRequest.mockImplementation(async (input) => {
      if (input.url.includes('type=jumpMyCenter')) {
        return response(
          'https://d.buaa.edu.cn/https-8346/example/?loginName=encoded-user#/MyCenter',
          '',
          200,
        );
      }
      if (input.url.includes('/app/user/login.action')) {
        return response(input.url, JSON.stringify({ STATUS: '0', result: { id: 'id', sessionId: 'session' } }));
      }
      if (input.url.includes('/app/common/get_timestamp.action')) {
        return response(input.url, JSON.stringify({ STATUS: '0', timestamp: '1' }));
      }
      if (input.url.includes('/app/course/get_stu_course_sched.action')) {
        return response(input.url, JSON.stringify({ STATUS: '400', ERRMSG: '签到服务异常' }));
      }
      throw new Error(`Unexpected request: ${input.url}`);
    });

    const service = new CampusService();
    service.mode = 'webvpn';
    await expect(service.loadSignins()).rejects.toThrow('签到服务异常');
  });
});
