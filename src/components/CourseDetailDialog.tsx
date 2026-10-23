import { BookOpen, Clock3, MapPin, UserRound, X } from 'lucide-react';
import type { Course } from '../types';

interface CourseDetailDialogProps {
  course: Course | null;
  onClose: () => void;
}

export function CourseDetailDialog({ course, onClose }: CourseDetailDialogProps) {
  if (!course) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="course-dialog" role="dialog" aria-modal="true" aria-label="课程详情">
        <button className="icon-button course-dialog__close" onClick={onClose} aria-label="关闭">
          <X size={20} />
        </button>
        <span className="course-dialog__bar" style={{ background: course.color ?? '#2c7a6b' }} />
        <div className="course-dialog__eyebrow"><BookOpen size={15} /> 课程详情</div>
        <h2>{course.name}</h2>
        <p className="course-dialog__sub">
          {course.code || '课程'}
          {course.credit ? ` · ${course.credit} 学分` : ''}
        </p>
        <div className="course-detail-grid">
          <div>
            <span><Clock3 size={17} /></span>
            <small>上课时间</small>
            <strong>
              {course.beginTime && course.endTime
                ? `${course.beginTime} — ${course.endTime}`
                : `第 ${course.beginSection ?? '?'}–${course.endSection ?? '?'} 节`}
            </strong>
          </div>
          <div>
            <span><MapPin size={17} /></span>
            <small>上课地点</small>
            <strong>{course.location || '地点待公布'}</strong>
          </div>
          <div>
            <span><UserRound size={17} /></span>
            <small>授课教师</small>
            <strong>{course.teachers || '教师待公布'}</strong>
          </div>
          <div>
            <span><BookOpen size={17} /></span>
            <small>课程代码</small>
            <strong>{course.code || '—'}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
