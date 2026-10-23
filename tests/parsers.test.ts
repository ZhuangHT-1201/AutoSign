import { describe, expect, it } from 'vitest';
import {
  coursesForWeek,
  parseCourses,
  parseProfile,
  parseSigninAction,
  parseSigninClasses,
  parseSigninLoginName,
  parseTerms,
  parseWeeks,
  selectedWeek,
} from '../src/lib/parsers';
import { fromWebVpnUrl, isWebVpnUrl, toWebVpnUrl } from '../src/lib/webvpn';

describe('schedule parsers', () => {
  it('normalizes terms and keeps the selected term first', () => {
    const terms = parseTerms({
      code: '0',
      datas: [
        { itemCode: '2025-2026-2', itemName: '第二学期', selected: false, itemIndex: 2 },
        { itemCode: '2025-2026-1', itemName: '第一学期', selected: true, itemIndex: 1 },
      ],
    });
    expect(terms.map((term) => term.code)).toEqual(['2025-2026-1', '2025-2026-2']);
    expect(terms[0].selected).toBe(true);
  });

  it('parses weeks and locates the current week', () => {
    const weeks = parseWeeks({
      datas: [
        {
          startDate: '2026-10-19',
          endDate: '2026-10-25',
          term: '2026-2027-1',
          curWeek: true,
          serialNumber: 8,
          name: '第8周',
        },
      ],
    });
    expect(selectedWeek(weeks, new Date(2026, 9, 23))?.number).toBe(8);
  });

  it('maps course fields and filters graduate week masks', () => {
    const courses = parseCourses({
      code: '0',
      datas: {
        arrangedList: [
          {
            courseCode: 'CS101',
            courseName: '数据结构',
            beginTime: '08:00',
            endTime: '09:35',
            beginSection: 1,
            endSection: 2,
            dayOfWeek: 1,
            placeName: '主楼 402',
          },
        ],
      },
    });
    expect(courses[0]).toMatchObject({
      name: '数据结构',
      location: '主楼 402',
      beginSection: 1,
    });
    expect(courses[0].color).toMatch(/^#[0-9a-f]{6}$/);
    expect(coursesForWeek([{ ...courses[0], weekNumbers: [2, 4] }], 3)).toHaveLength(0);
    expect(coursesForWeek([{ ...courses[0], weekNumbers: [2, 4] }], 4)).toHaveLength(1);
  });
});

describe('sign-in parsers', () => {
  it('extracts encoded login name from a WebVPN redirect', () => {
    const loginName = 'Rjc1QkJDMUMxNzVENkY0NkZCNzFDMEM5RjYwNzg4RDg=';
    expect(
      parseSigninLoginName(
        `https://iclass.buaa.edu.cn:8346/?loginName=${encodeURIComponent(loginName)}&type=jumpMyCenter#/MyCenter`,
      ),
    ).toBe(loginName);
  });

  it('accepts string status fields from the classroom service', () => {
    const classes = parseSigninClasses({
      STATUS: '0',
      result: [
        {
          id: 'schedule-1',
          courseName: '软件工程',
          classBeginTime: '14:00',
          classEndTime: '15:35',
          signStatus: '1',
        },
      ],
    });
    expect(classes[0].status).toBe(1);
    expect(classes[0].courseId).toBe('schedule-1');
  });

  it('maps known sign-in failures to a safe message', () => {
    expect(parseSigninAction({ STATUS: 400, ERRMSG: '您今天已经签到过了' })).toEqual({
      success: false,
      message: '今天已经签过到了',
    });
    expect(parseSigninAction({ STATUS: 0, result: { stuSignStatus: '1' } })).toEqual({
      success: true,
      message: '签到成功',
    });
  });

  it('extracts profile fields without assuming one upstream shape', () => {
    expect(
      parseProfile({ data: { name: '测试同学', schoolid: '22370001' } }, null),
    ).toMatchObject({ displayName: '测试同学', studentId: '22370001' });
  });
});

describe('WebVPN URL conversion', () => {
  it('decrypts the gateway host payload', () => {
    const encrypted =
      'https://d.buaa.edu.cn/http/77726476706e69737468656265737421f9b94389263126557a1dc7af96/web/';
    expect(fromWebVpnUrl(encrypted)).toBe('http://i.buaa.edu.cn/web/');
    expect(isWebVpnUrl(encrypted)).toBe(true);
  });

  it('round-trips a campus URL with a non-default port', () => {
    const wrapped = toWebVpnUrl('https://iclass.buaa.edu.cn:8347/app/course/list.action?x=1');
    expect(wrapped).toContain('https://d.buaa.edu.cn/https-8347/');
    expect(fromWebVpnUrl(wrapped)).toBe(
      'https://iclass.buaa.edu.cn:8347/app/course/list.action?x=1',
    );
  });
});
