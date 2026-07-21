-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  role text DEFAULT 'student'::text CHECK (role = ANY (ARRAY['student'::text, 'teacher'::text, 'admin'::text, 'master_admin'::text])),
  provider text,
  is_verified boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  department text,
  full_name text,
  password text,
  updated_at timestamp with time zone DEFAULT now(),
  enrollment_no text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  duration integer,
  total_marks integer,
  created_by uuid,
  status text DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text])),
  created_at timestamp without time zone DEFAULT now(),
  quiz_type text DEFAULT 'code'::text CHECK (quiz_type = ANY (ARRAY['mcq'::text, 'code'::text, 'hybrid'::text])),
  is_active boolean DEFAULT true,
  scheduled_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  institution_id bigint NOT NULL,
  course_offering_id bigint NOT NULL,
  deleted_at timestamp with time zone,
  is_archived boolean DEFAULT false,
  CONSTRAINT quizzes_pkey PRIMARY KEY (id),
  CONSTRAINT quizzes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT quizzes_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id),
  CONSTRAINT fk_quizzes_course_offering FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id)
);
CREATE TABLE public.quiz_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid,
  type text CHECK (type = ANY (ARRAY['MCQ'::text, 'DESCRIPTIVE'::text])),
  question text NOT NULL,
  options jsonb,
  correct_answer text,
  marks integer DEFAULT 1,
  CONSTRAINT quiz_questions_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id)
);
CREATE TABLE public.question_bank (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  text text NOT NULL,
  type text CHECK (type = ANY (ARRAY['MCQ'::text, 'DESCRIPTIVE'::text])),
  options jsonb,
  difficulty text CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])),
  created_by uuid,
  usage_count integer DEFAULT 0,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT question_bank_pkey PRIMARY KEY (id),
  CONSTRAINT question_bank_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attempt_id uuid,
  evaluator_id uuid,
  remarks text,
  evaluated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT evaluations_pkey PRIMARY KEY (id),
  CONSTRAINT evaluations_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action text,
  performed_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.settings (
  key text NOT NULL,
  value boolean,
  CONSTRAINT settings_pkey PRIMARY KEY (key)
);
CREATE TABLE public.questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  language text,
  input_format text,
  output_format text,
  type text CHECK (type = ANY (ARRAY['mcq'::text, 'code'::text, 'hybrid'::text])),
  weightage integer DEFAULT 10,
  created_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  image_url text,
  topic_id integer,
  topic_confidence numeric,
  updated_at timestamp with time zone DEFAULT now(),
  function_name text,
  institution_id bigint,
  difficulty text CHECK (difficulty IS NULL OR (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text]))),
  visibility text NOT NULL DEFAULT 'private'::text CHECK (visibility = ANY (ARRAY['public'::text, 'private'::text, 'shared'::text])),
  deleted_at timestamp with time zone,
  is_archived boolean DEFAULT false,
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT questions_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id),
  CONSTRAINT questions_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id)
);
CREATE TABLE public.testcases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid,
  input text NOT NULL,
  expected_output text NOT NULL,
  is_hidden boolean DEFAULT false,
  CONSTRAINT testcases_pkey PRIMARY KEY (id),
  CONSTRAINT testcases_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.mcq_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid,
  option_text text,
  is_correct boolean DEFAULT false,
  CONSTRAINT mcq_options_pkey PRIMARY KEY (id),
  CONSTRAINT mcq_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.quiz_questions_map (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid,
  question_id uuid,
  weightage integer NOT NULL,
  CONSTRAINT quiz_questions_map_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_questions_map_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id),
  CONSTRAINT quiz_questions_map_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.quiz_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  quiz_id uuid,
  score numeric DEFAULT 0,
  status text DEFAULT 'in_progress'::text CHECK (status = ANY (ARRAY['in_progress'::text, 'submitted'::text, 'evaluated'::text])),
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  total_marks integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  question_order jsonb DEFAULT '[]'::jsonb,
  option_order jsonb DEFAULT '{}'::jsonb,
  time_taken_seconds integer CHECK (time_taken_seconds >= 0),
  submission_count integer NOT NULL DEFAULT 0 CHECK (submission_count >= 0),
  ip_address inet,
  CONSTRAINT quiz_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT quiz_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id)
);
CREATE TABLE public.quiz_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attempt_id uuid,
  question_id uuid,
  selected_option text,
  submitted_code text,
  is_correct boolean DEFAULT false,
  marks_awarded numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  marks_obtained double precision DEFAULT 0,
  feedback text,
  ai_analysis jsonb,
  test_cases_passed integer,
  total_test_cases integer,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quiz_answers_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.quiz_attempts(id),
  CONSTRAINT quiz_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.access_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role text NOT NULL,
  department text,
  provider text NOT NULL,
  status text DEFAULT 'pending'::text,
  created_at timestamp without time zone DEFAULT now(),
  name text,
  password text,
  institution_id bigint,
  CONSTRAINT access_requests_pkey PRIMARY KEY (id),
  CONSTRAINT access_requests_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id)
);
CREATE TABLE public.question_topics_legacy (
  question_id uuid NOT NULL,
  topic text NOT NULL,
  confidence_score numeric,
  generated_by text DEFAULT 'groq'::text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT question_topics_legacy_pkey PRIMARY KEY (question_id),
  CONSTRAINT question_topics_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.topics (
  id integer NOT NULL,
  name text NOT NULL UNIQUE,
  CONSTRAINT topics_pkey PRIMARY KEY (id)
);
CREATE TABLE public.submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  question_id uuid,
  quiz_id uuid,
  source_code text NOT NULL,
  language_id integer NOT NULL,
  status_id integer,
  memory integer,
  time double precision,
  is_correct boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT submissions_pkey PRIMARY KEY (id),
  CONSTRAINT submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT submissions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id),
  CONSTRAINT submissions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id)
);
CREATE TABLE public.exam_behavior_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  quiz_id uuid,
  attempt_id uuid,
  tab_switches integer DEFAULT 0,
  fullscreen_exits integer DEFAULT 0,
  window_blurs integer DEFAULT 0,
  copy_events integer DEFAULT 0,
  devtools_attempts integer DEFAULT 0,
  final_score integer DEFAULT 0,
  risk_level text DEFAULT 'Safe'::text,
  reasons jsonb DEFAULT '[]'::jsonb,
  event_timeline jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exam_behavior_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.institutions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  logo_url text,
  website text,
  country text,
  state text,
  city text,
  timezone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT institutions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.departments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  institution_id bigint NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id),
  CONSTRAINT departments_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id)
);
CREATE TABLE public.programs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  institution_id bigint NOT NULL,
  department_id bigint,
  name text NOT NULL,
  level text,
  duration_years numeric CHECK (duration_years IS NULL OR duration_years > 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT programs_pkey PRIMARY KEY (id),
  CONSTRAINT programs_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id),
  CONSTRAINT programs_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.academic_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  institution_id bigint NOT NULL,
  name text NOT NULL,
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT academic_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT academic_sessions_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id)
);
CREATE TABLE public.academic_terms (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  institution_id bigint NOT NULL,
  program_id bigint NOT NULL,
  session_id bigint NOT NULL,
  term_number smallint NOT NULL,
  term_type text NOT NULL CHECK (term_type = ANY (ARRAY['semester'::text, 'trimester'::text, 'quarter'::text, 'year'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT academic_terms_pkey PRIMARY KEY (id),
  CONSTRAINT academic_terms_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id),
  CONSTRAINT academic_terms_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id),
  CONSTRAINT academic_terms_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.academic_sessions(id)
);
CREATE TABLE public.sections (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  institution_id bigint NOT NULL,
  academic_term_id bigint NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sections_pkey PRIMARY KEY (id),
  CONSTRAINT sections_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id),
  CONSTRAINT sections_academic_term_id_fkey FOREIGN KEY (academic_term_id) REFERENCES public.academic_terms(id)
);
CREATE TABLE public.subjects (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  institution_id bigint NOT NULL,
  program_id bigint NOT NULL,
  academic_term_id bigint NOT NULL,
  code text,
  name text NOT NULL,
  credits numeric CHECK (credits IS NULL OR credits >= 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id),
  CONSTRAINT subjects_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id),
  CONSTRAINT subjects_academic_term_id_fkey FOREIGN KEY (academic_term_id) REFERENCES public.academic_terms(id)
);
CREATE TABLE public.institution_memberships (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  institution_id bigint NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['student'::text, 'teacher'::text, 'admin'::text, 'institution_admin'::text, 'department_admin'::text, 'reviewer'::text, 'teaching_assistant'::text])),
  department_id bigint,
  program_id bigint,
  academic_term_id bigint,
  section_id bigint,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT institution_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT institution_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT institution_memberships_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id),
  CONSTRAINT institution_memberships_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id),
  CONSTRAINT institution_memberships_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id),
  CONSTRAINT institution_memberships_academic_term_id_fkey FOREIGN KEY (academic_term_id) REFERENCES public.academic_terms(id),
  CONSTRAINT institution_memberships_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id)
);
CREATE TABLE public.enrollments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  membership_id bigint NOT NULL,
  institution_id bigint NOT NULL,
  enrollment_no text,
  program_id bigint,
  academic_term_id bigint,
  section_id bigint,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'graduated'::text, 'transferred'::text, 'withdrawn'::text, 'suspended'::text, 'pending'::text])),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT enrollments_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.institution_memberships(id),
  CONSTRAINT enrollments_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id),
  CONSTRAINT enrollments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id),
  CONSTRAINT enrollments_academic_term_id_fkey FOREIGN KEY (academic_term_id) REFERENCES public.academic_terms(id),
  CONSTRAINT enrollments_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id)
);
CREATE TABLE public.providers (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT providers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tags (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tags_pkey PRIMARY KEY (id)
);
CREATE TABLE public.question_tags (
  question_id uuid NOT NULL,
  tag_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT question_tags_pkey PRIMARY KEY (question_id, tag_id),
  CONSTRAINT question_tags_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id),
  CONSTRAINT question_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);
CREATE TABLE public.user_api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider_id bigint NOT NULL,
  encrypted_api_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_api_keys_pkey PRIMARY KEY (id),
  CONSTRAINT user_api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_api_keys_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id)
);
CREATE TABLE public.course_offerings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  institution_id bigint NOT NULL,
  subject_id bigint NOT NULL,
  teacher_id uuid,
  academic_term_id bigint NOT NULL,
  section_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT course_offerings_pkey PRIMARY KEY (id),
  CONSTRAINT course_offerings_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id),
  CONSTRAINT course_offerings_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT course_offerings_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id),
  CONSTRAINT course_offerings_academic_term_id_fkey FOREIGN KEY (academic_term_id) REFERENCES public.academic_terms(id),
  CONSTRAINT course_offerings_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id)
);