# Quiz Creation Flow

This document explicitly details the hierarchy and data flow involved in creating a Quiz in the new institutional model (Phase 2 and beyond).

## Structural Hierarchy

The new academic model strictly follows this hierarchy to ensure multi-tenant safety and normalization:

```
Institution
   │
   ├─ Program
   │
   ├─ Academic Term
   │
   └─ Subject
         │
         ▼
  Course Offering  ◄── (Teacher A, Owner)
         │         ◄── (Teacher B, Assistant - *Future V2*)
         ▼
       Quiz
         │
         ▼
     Questions
```

## Step-by-Step Flow

### 1. Teacher Dashboard (`GET /academics`)
When a teacher opens the "Create Quiz" page, the frontend fetches the teacher's active catalog.
The query joins `course_offerings` with `subjects` and `academic_terms` where the `course_offering.teacher_id` equals the authenticated user.

### 2. Frontend Selection
Instead of selecting a raw "Department", "Semester", and "Subject" string, the teacher selects a single **Course Offering**.
The `course_offering_id` encodes the exact Institution, Program, Term, Subject, and Instructor.

### 3. Backend Verification (`POST /quiz/full`)
When the frontend submits the payload, the backend does **not** trust the frontend. It performs the following runtime checks:
- **Existence:** Does the `courseOfferingId` exist?
- **Tenant & Ownership Verification:** Does the `courseOffering` belong to the authenticated `teacher_id`?
- **Data Hydration:** The backend retrieves the `institution_id` directly from the `courseOffering` database record, ensuring cross-tenant contamination is impossible.

### 4. Database Insertion
The Quiz is inserted with:
- `institution_id` (Derived from backend)
- `course_offering_id` (Validated by backend)
- No legacy columns (`subject`, `department`, `semester`, `created_by` are explicitly omitted in new mode).

### 5. Future Considerations
Currently, `teacher_id` is a direct column on `course_offerings`. As the platform grows, this may be extracted into a `course_offering_instructors` junction table to support co-teaching and reviewers without altering the Quiz ownership flow.
