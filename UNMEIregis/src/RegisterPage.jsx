import React, { useState, useEffect } from 'react';
import 'iconify-icon';
import { auth, database } from './firebase';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';

// RTDB RESTORED: native Realtime Database access (migration back from the
// Phase 8 Firestore shim). readNode() preserves the RTDB-style
// { exists(), val(): {id: record} } shape consumed by the duplicate-scan
// logic below.
const readNode = async (name) => {
    const snap = await get(ref(database, name));
    const val = snap.exists() ? snap.val() : {};
    return { exists: () => Object.keys(val).length > 0, val: () => val };
};
const writeDoc = (coll, uid, payload) =>
    set(ref(database, coll + '/' + uid), JSON.parse(JSON.stringify(payload)));
import preenrollHeader from './assets/preenroll-header.jpg';

// ---------- Email validation policy (PHASE 1 hardening) ----------
// Strict format: local part, domain, and a TLD of at least two characters.
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// Disposable/generic domains that indicate a throwaway or placeholder address.
const BLOCKED_EMAIL_DOMAINS = [
    'email.com', 'test.com', 'example.com', 'mailinator.com',
    'tempmail.com', 'guerrillamail.com', 'throwaway.email', 'yopmail.com'
];

function getEmailValidationError(rawEmail) {
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
        return 'Enter a valid email address (e.g. yourname@gmail.com).';
    }
    const domain = email.split('@')[1];
    if (domain === 'email.com') {
        return 'Please use a real email address. Generic domains like @email.com are not accepted.';
    }
    if (BLOCKED_EMAIL_DOMAINS.includes(domain)) {
        return 'Disposable or placeholder email domains are not accepted. Please use a real email address you can access.';
    }
    return '';
}


// Iconify-based icon components (self-hosted web component via the
// iconify-icon package). Each mirrors the lucide-react API surface used in
// this file (size + className) so call sites remain unchanged.
const makeIcon = (icon) => ({ size = 20, className = '' }) => (
    <iconify-icon icon={icon} width={size} height={size} class={className} />
);

const Mail = makeIcon('mdi:email-outline');
const Lock = makeIcon('mdi:lock-outline');
const User = makeIcon('mdi:account-outline');
const Eye = makeIcon('mdi:eye-outline');
const EyeOff = makeIcon('mdi:eye-off-outline');
const MapPin = makeIcon('mdi:map-marker-outline');
const Phone = makeIcon('mdi:phone-outline');
const Globe = makeIcon('mdi:web');
const Link2 = makeIcon('mdi:link-variant');
const BookOpen = makeIcon('mdi:book-open-variant');
const Monitor = makeIcon('mdi:monitor');
const ChevronDown = makeIcon('mdi:chevron-down');
const CheckCircle = makeIcon('mdi:check-circle-outline');
const X = makeIcon('mdi:close');
const AlertCircle = makeIcon('mdi:alert-circle-outline');
const Check = makeIcon('mdi:check');
const ArrowRight = makeIcon('mdi:arrow-right');
const ArrowLeft = makeIcon('mdi:arrow-left');
const Clock = makeIcon('mdi:clock-outline');
const CalendarDays = makeIcon('mdi:calendar-month-outline');
const Target = makeIcon('mdi:target');

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        fullName: '',
        socialMediaLink: '',
        country: 'Philippines',
        countryCode: '+63',
        address: '',
        mobileNumber: '',
        wantCall: '',
        email: '',
        course: '',
        classSetup: '',
        scheduleTimeSlot: '',
        scheduleDays: '',
        japaneseKnowledge: '',
        purpose: '',
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');
    const [popup, setPopup] = useState({
        isOpen: false,
        type: 'success',
        title: '',
        message: ''
    });

    // New States for Polish
    const [toast, setToast] = useState({ isOpen: false, message: '' });
    const [fieldErrors, setFieldErrors] = useState({});
    const [emailStatus, setEmailStatus] = useState(null); // null | 'checking' | 'valid' | 'duplicate' | 'invalid'
    const [nameWarning, setNameWarning] = useState(null);
    const [agreed, setAgreed] = useState(false); // registration consent checkbox

    // Comprehensive list of countries with dial codes
    const countries = [
        { name: 'Afghanistan', code: '+93' },
        { name: 'Albania', code: '+355' },
        { name: 'Algeria', code: '+213' },
        { name: 'Argentina', code: '+54' },
        { name: 'Australia', code: '+61' },
        { name: 'Austria', code: '+43' },
        { name: 'Bangladesh', code: '+880' },
        { name: 'Belgium', code: '+32' },
        { name: 'Brazil', code: '+55' },
        { name: 'Canada', code: '+1' },
        { name: 'Chile', code: '+56' },
        { name: 'China', code: '+86' },
        { name: 'Colombia', code: '+57' },
        { name: 'Czech Republic', code: '+420' },
        { name: 'Denmark', code: '+45' },
        { name: 'Egypt', code: '+20' },
        { name: 'Finland', code: '+358' },
        { name: 'France', code: '+33' },
        { name: 'Germany', code: '+49' },
        { name: 'Greece', code: '+30' },
        { name: 'Hong Kong', code: '+852' },
        { name: 'Hungary', code: '+36' },
        { name: 'India', code: '+91' },
        { name: 'Indonesia', code: '+62' },
        { name: 'Ireland', code: '+353' },
        { name: 'Israel', code: '+972' },
        { name: 'Italy', code: '+39' },
        { name: 'Japan', code: '+81' },
        { name: 'Malaysia', code: '+60' },
        { name: 'Mexico', code: '+52' },
        { name: 'Netherlands', code: '+31' },
        { name: 'New Zealand', code: '+64' },
        { name: 'Nigeria', code: '+234' },
        { name: 'Norway', code: '+47' },
        { name: 'Pakistan', code: '+92' },
        { name: 'Philippines', code: '+63' },
        { name: 'Poland', code: '+48' },
        { name: 'Portugal', code: '+351' },
        { name: 'Romania', code: '+40' },
        { name: 'Russia', code: '+7' },
        { name: 'Saudi Arabia', code: '+966' },
        { name: 'Singapore', code: '+65' },
        { name: 'South Africa', code: '+27' },
        { name: 'South Korea', code: '+82' },
        { name: 'Spain', code: '+34' },
        { name: 'Sweden', code: '+46' },
        { name: 'Switzerland', code: '+41' },
        { name: 'Taiwan', code: '+886' },
        { name: 'Thailand', code: '+66' },
        { name: 'Turkey', code: '+90' },
        { name: 'Ukraine', code: '+380' },
        { name: 'United Arab Emirates', code: '+971' },
        { name: 'United Kingdom', code: '+44' },
        { name: 'United States', code: '+1' },
        { name: 'Vietnam', code: '+84' }
    ];

    const filteredCountries = countries.filter(country =>
        country.name.toLowerCase().includes(countrySearch.toLowerCase())
    );

    const handleCountrySelect = (country) => {
        setFormData({
            ...formData,
            country: country.name,
            countryCode: country.code
        });
        setCountrySearch('');
        setShowCountryDropdown(false);
    };

    const closePopup = () => {
        setPopup(prev => ({ ...prev, isOpen: false }));
    };


    const courseOptions = [
        'JLPT N5 (Beginner)',
        'JLPT N4 (Intermediate)',
        'JLPT N3 (Advanced)',
        'JLPT N2 (Expert)',
        'Bundle N5 and N4 (Beginner to Intermediate)',
        'Bundle N5-N3 (Beginner to Advanced)'
    ];

    const classSetupOptions = [
        'Private',
        'Face-to-face',
        'Online'
    ];

    // Courses that require assessment (N4, N3, N2 - non-bundle)
    const coursesRequiringAssessment = ['JLPT N4 (Intermediate)', 'JLPT N3 (Advanced)', 'JLPT N2 (Expert)'];

    const [showAssessment, setShowAssessment] = useState(false);
    const [assessmentStarted, setAssessmentStarted] = useState(false);
    const [assessmentAnswers, setAssessmentAnswers] = useState({});
    const [assessmentSubmitted, setAssessmentSubmitted] = useState(false);
    const [assessmentScore, setAssessmentScore] = useState(null);
    const [essayAnswer, setEssayAnswer] = useState('');

    // Assessment questions data
    const assessmentQuestions = {
        'JLPT N4 (Intermediate)': {
            passingScore: 3,
            questions: [
                {
                    id: 'n4_q1',
                    question: 'Fill in the blank: きのう、友だち＿＿＿映画＿＿＿見ました',
                    options: [
                        { key: 'a', text: 'と・を' },
                        { key: 'b', text: 'に・が' },
                        { key: 'c', text: 'で・を' },
                        { key: 'd', text: 'と・が' }
                    ],
                    answer: 'a'
                },
                {
                    id: 'n4_q2',
                    question: 'Choose the correct sentence:',
                    options: [
                        { key: 'a', text: '毎日日本語を勉強します。' },
                        { key: 'b', text: '毎日日本語が勉強します。' },
                        { key: 'c', text: '毎日日本語に勉強します。' },
                        { key: 'd', text: '毎日日本語で勉強します。' }
                    ],
                    answer: 'a'
                },
                {
                    id: 'n4_q3',
                    question: 'Verb form: 先生は学生に「早く＿＿＿ください」と言いました。',
                    options: [
                        { key: 'a', text: '来る' },
                        { key: 'b', text: '来て' },
                        { key: 'c', text: '来た' },
                        { key: 'd', text: '来ない' }
                    ],
                    answer: 'b'
                },
                {
                    id: 'n4_q4',
                    question: 'Definition: ひまです',
                    options: [
                        { key: 'a', text: 'Busy' },
                        { key: 'b', text: 'Free / not busy' },
                        { key: 'c', text: 'Tired' },
                        { key: 'd', text: 'Lonely' }
                    ],
                    answer: 'b'
                },
                {
                    id: 'n4_q5',
                    question: 'Understanding: 今日は雨です。だから、学校に行きません。Why didn\'t the speaker go to school?',
                    options: [
                        { key: 'a', text: 'It was cold' },
                        { key: 'b', text: 'It was raining' },
                        { key: 'c', text: 'They were sick' },
                        { key: 'd', text: 'It was a holiday' }
                    ],
                    answer: 'b'
                }
            ]
        },
        'JLPT N3 (Advanced)': {
            passingScore: 3,
            questions: [
                {
                    id: 'n3_q1',
                    question: 'Correct grammar: 雨＿＿＿、試合は中止になりました。',
                    options: [
                        { key: 'a', text: 'のに' },
                        { key: 'b', text: 'から' },
                        { key: 'c', text: 'まで' },
                        { key: 'd', text: 'でも' }
                    ],
                    answer: 'b'
                },
                {
                    id: 'n3_q2',
                    question: 'What does 「〜ようになる」express?',
                    options: [
                        { key: 'a', text: 'Obligation' },
                        { key: 'b', text: 'Past habit' },
                        { key: 'c', text: 'Change over time' },
                        { key: 'd', text: 'Strong intention' }
                    ],
                    answer: 'c'
                },
                {
                    id: 'n3_q3',
                    question: 'Choose the most natural sentence:',
                    options: [
                        { key: 'a', text: '忙しいですが、行きます。' },
                        { key: 'b', text: '忙しいので、行きます。' },
                        { key: 'c', text: '忙しいのに、行きます。' },
                        { key: 'd', text: '忙しいから、行きません。' }
                    ],
                    answer: 'c'
                },
                {
                    id: 'n3_q4',
                    question: 'Reading: この薬はよく効きますが、眠くなることがあります。What is the warning?',
                    options: [
                        { key: 'a', text: 'It doesn\'t work well' },
                        { key: 'b', text: 'It is very expensive' },
                        { key: 'c', text: 'It may cause sleepiness' },
                        { key: 'd', text: 'It must be taken at night' }
                    ],
                    answer: 'c'
                }
            ]
        },
        'JLPT N2 (Expert)': {
            passingScore: 2,
            hasEssay: true,
            questions: [
                {
                    id: 'n2_q1',
                    question: 'Explain the difference between: 行かなければならない | and | 行くべきだ',
                    type: 'essay',
                    options: null,
                    answer: null
                },
                {
                    id: 'n2_q2',
                    question: 'Grammar choice: 彼は忙しい＿＿＿、連絡する時間がない。',
                    options: [
                        { key: 'a', text: 'ため' },
                        { key: 'b', text: 'そうで' },
                        { key: 'c', text: 'ように' },
                        { key: 'd', text: 'らしく' }
                    ],
                    answer: 'a'
                },
                {
                    id: 'n2_q3',
                    question: 'What is implied? 彼は口では簡単だと言っていたが、実際にやってみると想像以上に難しかった。',
                    options: [
                        { key: 'a', text: 'He failed completely' },
                        { key: 'b', text: 'He lied on purpose' },
                        { key: 'c', text: 'He underestimated the difficulty' },
                        { key: 'd', text: 'He didn\'t try seriously' }
                    ],
                    answer: 'c'
                },
                {
                    id: 'n2_q4',
                    question: 'Which is most suitable for a formal email?',
                    options: [
                        { key: 'a', text: 'ちょっと待ってください' },
                        { key: 'b', text: '少し待ってもいい？' },
                        { key: 'c', text: '少々お待ちください' },
                        { key: 'd', text: '待ちなさい' }
                    ],
                    answer: 'c'
                }
            ]
        }
    };

    // ---- RTDB-driven data (PHASE 6): load live assessment banks and
    // validation rules from the Realtime Database instead of only hardcoding.
    // Live fallback: any missing node degrades to the hardcoded objects above.
    const [liveAssessmentQuestions, setLiveAssessmentQuestions] = useState(null);
    const [validationRules, setValidationRules] = useState(null);

    useEffect(() => {
        let cancelled = false;

        // Course display name -> assessments/{level} key mapping.
        const courseLevelKey = {
            'JLPT N4 (Intermediate)': 'n4',
            'JLPT N3 (Advanced)': 'n3',
            'JLPT N2 (Expert)': 'n2'
        };
        const pending = Object.keys(courseLevelKey).map(async (courseName) => {
            const level = courseLevelKey[courseName];
            try {
                const snap = await get(ref(database, 'assessments/' + level));
                const val = snap.exists() ? snap.val() : null;
                if (!val || !Array.isArray(val.questions)) return null;
                return {
                    courseName: courseName,
                    passingScore: Number(val.passingScore || 0),
                    hasEssay: !!val.hasEssay,
                    questions: val.questions.map((q) => ({
                        id: q.id,
                        question: q.question,
                        type: q.type || 'mcq',
                        answer: q.answer ?? null,
                        options: Array.isArray(q.options) ? q.options.map((o) => ({ key: o.key, text: o.text })) : null
                    }))
                };
            } catch (e) {
                return null;
            }
        });

        Promise.all(pending).then((results) => {
            if (cancelled) return;
            const merged = {};
            results.forEach((r) => { if (r) merged[r.courseName] = r; });
            setLiveAssessmentQuestions(merged);
        });

        // Load validation_rules/enrollment from RTDB (used by the generic
        // rule pass in handleSubmit).
        readNode('validation_rules').then((snap) => {
            if (cancelled) return;
            const val = snap.exists() ? snap.val() : null;
            if (val && val.enrollment) setValidationRules(val.enrollment);
        }).catch(() => {});

        return () => { cancelled = true; };
    }, []);

    // Check if selected course requires assessment
    const requiresAssessment = coursesRequiringAssessment.includes(formData.course);
    const currentAssessment =
        (liveAssessmentQuestions && liveAssessmentQuestions[formData.course]) ||
        assessmentQuestions[formData.course];

    // Handle course change - show assessment if needed
    useEffect(() => {
        if (requiresAssessment && !assessmentSubmitted) {
            setShowAssessment(true);
            setAssessmentStarted(false);
            setAssessmentAnswers({});
            setAssessmentScore(null);
            setEssayAnswer('');
        } else {
            setShowAssessment(false);
        }
    }, [formData.course]);

    const handleAnswerSelect = (questionId, answerKey) => {
        setAssessmentAnswers(prev => ({
            ...prev,
            [questionId]: answerKey
        }));
    };

    const submitAssessment = () => {
        if (!currentAssessment) return;

        let score = 0;
        currentAssessment.questions.forEach(q => {
            if (q.type !== 'essay' && assessmentAnswers[q.id] === q.answer) {
                score++;
            }
        });

        setAssessmentScore(score);
        setAssessmentSubmitted(true);
        setAssessmentStarted(false);
        setShowAssessment(false);
    };

    const showToast = (message) => {
        setToast({ isOpen: true, message });
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            setToast(prev => ({ ...prev, isOpen: false }));
        }, 10000);
    };

    const SATURDAY_DAYS = 'Saturday Only';
    const SATURDAY_SLOT = '8am - 5pm (Sat Only)';

    const handleChange = (e) => {
        const { name, value } = e.target;

        // Schedule pairing rule: the Saturday-only full-day slot is exclusive
        // to the Saturday-only schedule, and vice versa.
        if (name === 'scheduleDays') {
            if (value === SATURDAY_DAYS) {
                setFormData({ ...formData, scheduleDays: value, scheduleTimeSlot: SATURDAY_SLOT });
            } else if (formData.scheduleTimeSlot === SATURDAY_SLOT) {
                setFormData({ ...formData, scheduleDays: value, scheduleTimeSlot: '' });
            } else {
                setFormData({ ...formData, [name]: value });
            }
        } else if (name === 'scheduleTimeSlot') {
            if (value === SATURDAY_SLOT) {
                setFormData({ ...formData, scheduleTimeSlot: value, scheduleDays: SATURDAY_DAYS });
            } else if (formData.scheduleDays === SATURDAY_DAYS) {
                setFormData({ ...formData, scheduleTimeSlot: value, scheduleDays: '' });
            } else {
                setFormData({ ...formData, [name]: value });
            }
        } else {
            setFormData({ ...formData, [name]: value });
        }

        // Clear error for the field being typed in
        if (fieldErrors[name]) {
            setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    // Real-time debounced email validation and duplicate check
    useEffect(() => {
        if (!formData.email || formData.email.trim().length === 0) {
            setEmailStatus(null);
            return;
        }

        const policyError = getEmailValidationError(formData.email);
        if (policyError) {
            setEmailStatus('invalid');
            setFieldErrors(prev => ({ ...prev, email: policyError }));
            return;
        }

        setEmailStatus('checking');
        const timer = setTimeout(async () => {
            try {
                const cleanEmail = formData.email.trim().toLowerCase();
                // Duplicate scan across ALL identity-bearing nodes: users/,
                // students/, and enrollments/ — a match in any of the three
                // blocks registration.
                const [usersSnap, studentsSnap, enrollmentsSnap] = await Promise.all([
                    readNode('users'),
                    readNode('students'),
                    readNode('enrollments')
                ]);
                let found = false;
                if (usersSnap.exists()) {
                    const usersVal = usersSnap.val();
                    for (const uid in usersVal) {
                        if (usersVal[uid]?.email && usersVal[uid].email.toLowerCase() === cleanEmail) {
                            found = true;
                            break;
                        }
                    }
                }
                if (!found && studentsSnap.exists()) {
                    const studentsVal = studentsSnap.val();
                    for (const uid in studentsVal) {
                        if (studentsVal[uid]?.profile?.email && String(studentsVal[uid].profile.email).toLowerCase() === cleanEmail) {
                            found = true;
                            break;
                        }
                    }
                }
                if (!found && enrollmentsSnap.exists()) {
                    const enrVal = enrollmentsSnap.val();
                    for (const uid in enrVal) {
                        if (enrVal[uid]?.email && String(enrVal[uid].email).toLowerCase() === cleanEmail) {
                            found = true;
                            break;
                        }
                    }
                }
                if (found) {
                    setEmailStatus('duplicate');
                    setFieldErrors(prev => ({
                        ...prev,
                        email: 'This email is already registered. Please sign in or use a different email.'
                    }));
                } else {
                    setEmailStatus('valid');
                    setFieldErrors(prev => {
                        const next = { ...prev };
                        delete next.email;
                        return next;
                    });
                }
            } catch (err) {
                setEmailStatus('valid');
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [formData.email]);

    // Duplicate name warning
    useEffect(() => {
        if (!formData.fullName || formData.fullName.trim().length < 4) {
            setNameWarning(null);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const cleanName = formData.fullName.trim().toLowerCase();
                const studentsSnap = await readNode('students');
                let found = false;
                if (studentsSnap.exists()) {
                    const studentsVal = studentsSnap.val();
                    for (const uid in studentsVal) {
                        const existingName = studentsVal[uid]?.profile?.fullName || '';
                        if (existingName.toLowerCase() === cleanName) {
                            found = true;
                            break;
                        }
                    }
                }
                if (found) {
                    setNameWarning('Note: An existing student record with a similar name was found in the database.');
                } else {
                    setNameWarning(null);
                }
            } catch (err) {
                setNameWarning(null);
            }
        }, 600);

        return () => clearTimeout(timer);
    }, [formData.fullName]);

    const handleSubmit = async () => {
        // Build field errors object
        const newErrors = {};
        const requiredFields = {
            fullName: 'Full Name',
            socialMediaLink: 'Social Media Profile Link',
            country: 'Country',
            address: 'Complete Address',
            mobileNumber: 'Mobile Number',
            wantCall: 'Call Preference',
            email: 'Email Address',
            course: 'Course',
            classSetup: 'Class Setup',
            scheduleTimeSlot: 'Preferred Schedule Time',
            scheduleDays: 'Preferred Schedule Days',
            japaneseKnowledge: 'Japanese Knowledge Level',
            purpose: 'Purpose for Studying',
            password: 'Password',
            confirmPassword: 'Confirm Password'
        };

        for (const [field, label] of Object.entries(requiredFields)) {
            if (!formData[field]) {
                newErrors[field] = `${label} is required.`;
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setFieldErrors(newErrors);
            showToast('Please fill in all required fields to proceed.');
            return;
        }

        // RTDB-driven validation rules (PHASE 6): when validation_rules/
        // enrollment is reachable, enforce its minLength/maxLength/pattern/
        // allowedValues constraints generically. Missing fields in the RTDB
        // schema are skipped; if the node is unreachable this pass is skipped
        // entirely (the explicit per-field checks below still apply).
        if (validationRules) {
            const valueOf = (field) => String(formData[field] == null ? '' : formData[field]);
            for (const field of Object.keys(validationRules)) {
                if (newErrors[field]) continue;
                const rule = validationRules[field] || {};
                const value = valueOf(field);
                if (rule.required && !value.trim()) {
                    newErrors[field] = rule.errorMessage || (field + ' is required.');
                    continue;
                }
                if (Array.isArray(rule.allowedValues) && rule.allowedValues.length && value && !rule.allowedValues.includes(value)) {
                    newErrors[field] = rule.errorMessage || ('Please provide a valid ' + field + '.');
                    continue;
                }
                if (typeof rule.minLength === 'number' && value && value.length < rule.minLength) {
                    newErrors[field] = rule.errorMessage || (field + ' is too short.');
                    continue;
                }
                if (typeof rule.maxLength === 'number' && value && value.length > rule.maxLength) {
                    newErrors[field] = rule.errorMessage || (field + ' is too long.');
                    continue;
                }
                if (rule.pattern && value && !new RegExp(rule.pattern).test(value)) {
                    newErrors[field] = rule.errorMessage || ('Please provide a valid ' + field + '.');
                    continue;
                }
                if (rule.mustMatch && value && value !== valueOf(rule.mustMatch)) {
                    newErrors[field] = rule.errorMessage || (field + ' does not match.');
                }
            }
            const added = Object.keys(newErrors).filter((k) => newErrors[k]);
            if (added.length) {
                setFieldErrors({ ...newErrors });
                showToast('Please correct the highlighted fields to proceed.');
                return;
            }
        }

        // Submit-time email policy check: format, disposable-domain blocklist,
        // and generic @email.com rejection. Runs even if the debounced
        // real-time check has not completed yet.
        const emailPolicyError = getEmailValidationError(formData.email);
        if (emailPolicyError) {
            setFieldErrors(prev => ({ ...prev, email: emailPolicyError }));
            setEmailStatus('invalid');
            showToast(emailPolicyError);
            return;
        }

        if (emailStatus === 'duplicate') {
            setFieldErrors(prev => ({
                ...prev,
                email: 'This email is already registered. Please sign in or use a different email.'
            }));
            showToast('This email is already registered. Please sign in to your account.');
            return;
        }

        // Facebook-only profile link validation
        const fbLink = formData.socialMediaLink.trim();
        const fbLinkOk = /^(https?:\/\/)?(www\.)?(facebook|fb)\.(com|me)\/[A-Za-z0-9._\-/?]+/i.test(fbLink);
        if (!fbLinkOk) {
            setFieldErrors(prev => ({
                ...prev,
                socialMediaLink: 'Please provide a Facebook profile link only (e.g. facebook.com/your.name or fb.com/your.name).'
            }));
            showToast('The social media field accepts Facebook profile links only.');
            return;
        }

        // Mobile number validation based on the selected country
        const digitsOnly = formData.mobileNumber.replace(/\D/g, '');
        if (formData.countryCode === '+63') {
            if (!/^9\d{9}$/.test(digitsOnly)) {
                setFieldErrors(prev => ({
                    ...prev,
                    mobileNumber: 'Enter a valid Philippine mobile number: 10 digits starting with 9 (e.g. 917 123 4567).'
                }));
                showToast('Please check your mobile number. Philippine numbers are 10 digits starting with 9.');
                return;
            }
        } else if (digitsOnly.length < 7 || digitsOnly.length > 15) {
            setFieldErrors(prev => ({
                ...prev,
                mobileNumber: 'Enter a valid mobile number for ' + formData.country + ' (7-15 digits).'
            }));
            showToast('Please check your mobile number.');
            return;
        }

        // Registration agreement gate
        if (!agreed) {
            showToast('Please tick the agreement box to confirm your enrollment details.');
            const agreeBox = document.getElementById('regAgreementCard');
            if (agreeBox) {
                agreeBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                agreeBox.classList.add('animate-fadeIn');
            }
            return;
        }

        // Saturday pairing guard (backup for the auto-pairing in handleChange)
        if (formData.scheduleDays === 'Saturday Only' && formData.scheduleTimeSlot !== '8am - 5pm (Sat Only)') {
            setFieldErrors(prev => ({ ...prev, scheduleTimeSlot: 'Saturday-only classes run 8am - 5pm. Please select the Saturday time slot.' }));
            showToast('Saturday-only classes use the 8am - 5pm (Sat Only) time slot.');
            return;
        }
        if (formData.scheduleDays !== 'Saturday Only' && formData.scheduleTimeSlot === '8am - 5pm (Sat Only)') {
            setFieldErrors(prev => ({ ...prev, scheduleDays: 'The 8am - 5pm full-day slot is exclusive to Saturday-only classes.' }));
            showToast('The 8am - 5pm (Sat Only) slot applies to Saturday-only classes.');
            return;
        }

        // Strict complete address validation: requires min 15 chars and commas for street, city, province
        if (formData.address.trim().length < 15 || !formData.address.includes(',')) {
            setFieldErrors(prev => ({
                ...prev,
                address: 'Please enter a complete address (e.g. Street/Barangay, City/Municipality, Province).'
            }));
            showToast('Please enter a complete address including street, city, and province.');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setPopup({
                isOpen: true,
                type: 'error',
                title: 'Password Mismatch',
                message: 'The passwords you entered do not match.'
            });
            return;
        }

        if (formData.password.length < 6) {
            setPopup({
                isOpen: true,
                type: 'error',
                title: 'Weak Password',
                message: 'Password must be at least 6 characters long.'
            });
            return;
        }

        // Check if assessment is required but not completed
        if (requiresAssessment && !assessmentSubmitted) {
            setPopup({
                isOpen: true,
                type: 'error',
                title: 'Assessment Required',
                message: 'Please complete the level assessment before submitting your enrollment.'
            });
            setShowAssessment(true);
            return;
        }

        // Check if assessment was failed
        if (requiresAssessment && assessmentSubmitted && currentAssessment && assessmentScore < currentAssessment.passingScore) {
            setPopup({
                isOpen: true,
                type: 'error',
                title: 'Assessment Not Passed',
                message: `You scored ${assessmentScore}/${currentAssessment.questions.filter(q => q.type !== 'essay').length}. A minimum of ${currentAssessment.passingScore} is required. Please select a different course or try N5 first.`
            });
            return;
        }

        setLoading(true);

        try {
            // Final pre-creation re-validation: the email policy and live
            // duplicates are checked one last time immediately before the
            // Firebase Auth call, closing any race between typing and submit.
            const finalPolicyError = getEmailValidationError(formData.email);
            if (finalPolicyError) {
                setLoading(false);
                setPopup({
                    isOpen: true,
                    type: 'error',
                    title: 'Email Not Accepted',
                    message: finalPolicyError
                });
                return;
            }
            const cleanFinal = formData.email.trim().toLowerCase();
            const [finalUsers, finalStudents, finalEnrollments] = await Promise.all([
                readNode('users'),
                readNode('students'),
                readNode('enrollments')
            ]);
            let duplicateExists = false;
            const scanNode = (snap, pick) => {
                if (duplicateExists || !snap.exists()) return;
                const val = snap.val();
                for (const uid in val) {
                    if (String(pick(val[uid]) || '').toLowerCase() === cleanFinal) {
                        duplicateExists = true;
                        break;
                    }
                }
            };
            scanNode(finalUsers, v => v?.email);
            scanNode(finalStudents, v => v?.profile?.email);
            scanNode(finalEnrollments, v => v?.email);
            if (duplicateExists) {
                setLoading(false);
                setFieldErrors(prev => ({
                    ...prev,
                    email: 'This email is already registered. Please sign in or use a different email.'
                }));
                setPopup({
                    isOpen: true,
                    type: 'error',
                    title: 'Email Already Registered',
                    message: 'This email is already in use by an existing account. Please sign in instead.'
                });
                return;
            }

            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            const nameParts = (formData.fullName || 'Student').trim().split(/\s+/);
            const initials = nameParts.length > 1 ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase() : nameParts[0].slice(0, 2).toUpperCase();

            // Course mapping
            let courseId = 'jlpt_n5';
            if (formData.course.includes('N4')) courseId = 'jlpt_n4';
            if (formData.course.includes('N3')) courseId = 'jlpt_n3';
            if (formData.course.includes('N2')) courseId = 'jlpt_n2';
            if (formData.course.includes('Bundle N5 and N4')) courseId = 'bundle_n5_n4';
            if (formData.course.includes('Bundle N5-N3')) courseId = 'bundle_n5_n3';

            const now = Date.now();

            // 1. Write to students/{uid}
            await writeDoc('students', user.uid, {
                profile: {
                    fullName: formData.fullName,
                    email: formData.email,
                    mobileNumber: `${formData.countryCode} ${formData.mobileNumber}`,
                    address: formData.address,
                    country: formData.country,
                    avatarInitials: initials,
                    avatarColor: '#C0392B',
                    createdAt: now,
                    updatedAt: now
                },
                enrollment: {
                    course: formData.course,
                    courseId: courseId,
                    classSetup: formData.classSetup,
                    scheduleTimeSlot: formData.scheduleTimeSlot,
                    scheduleDays: formData.scheduleDays,
                    status: 'active',
                    enrolledAt: now
                },
                scores: {
                    reading: 0,
                    writing: 0,
                    listening: 0,
                    speaking: 0,
                    grammar: 0,
                    vocabulary: 0,
                    updatedAt: now
                },
                attendance: 0,
                appSyncData: {
                    appVersion: '',
                    currentModule: 0,
                    modulesCompleted: 0,
                    totalModules: 12,
                    totalPracticeMinutes: 0,
                    totalSessionsCompleted: 0,
                    streakDays: 0,
                    charactersMastered: 0,
                    platform: 'web',
                    lastSyncTimestamp: 0
                },
                trend: 'neutral',
                classIds: [],
                settings: {
                    emailNotifications: true,
                    smsNotifications: false,
                    language: 'en',
                    theme: 'light',
                    updatedAt: now
                },
                session: {
                    lastActivity: 0,
                    timeoutMinutes: 30,
                    token: ''
                },
                onboardingComplete: false,
                isRevoked: false,
                isDeleted: false,
                registrationAgreement: {
                    accepted: true,
                    acceptedAt: now,
                    version: 'pre-enrollment-consent-v1'
                }
            });

            // 2. Write to users/{uid}
            await writeDoc('users', user.uid, {
                email: formData.email,
                role: 'student',
                uid: user.uid,
                createdAt: now
            });

            // 2b. Email verification (adviser requirement): send the Firebase
            // Auth verification email right after account creation. Non-fatal:
            // a delivery failure must not block or roll back the registration.
            try {
                await sendEmailVerification(user);
            } catch (verificationError) {
                console.warn('Verification email could not be sent:', verificationError);
            }

            // 3. Write to enrollments/{uid}
            await writeDoc('enrollments', user.uid, {
                fullName: formData.fullName,
                socialMediaLink: formData.socialMediaLink,
                email: formData.email,
                country: formData.country,
                countryCode: formData.countryCode,
                mobileNumber: `${formData.countryCode} ${formData.mobileNumber}`,
                wantCall: formData.wantCall,
                address: formData.address,
                course: formData.course,
                courseId: courseId,
                classSetup: formData.classSetup,
                scheduleTimeSlot: formData.scheduleTimeSlot,
                scheduleDays: formData.scheduleDays,
                japaneseKnowledge: formData.japaneseKnowledge,
                purpose: formData.purpose,
                status: 'active',
                assessmentScore: assessmentScore,
                assessmentPassed: currentAssessment ? assessmentScore >= currentAssessment.passingScore : null,
                assessmentAnswers: requiresAssessment ? assessmentAnswers : null,
                essayAnswer: currentAssessment?.hasEssay ? essayAnswer : null,
                registrationAgreement: {
                    accepted: true,
                    acceptedAt: now,
                    version: 'pre-enrollment-consent-v1'
                },
                createdAt: now,
                updatedAt: now
            });

            // 4. If wantCall is Yes, write contact lead for admin
            if (formData.wantCall === 'yes') {
                await writeDoc('contact_leads', user.uid, {
                    fullName: formData.fullName,
                    email: formData.email,
                    mobileNumber: `${formData.countryCode} ${formData.mobileNumber}`,
                    countryCode: formData.countryCode,
                    course: formData.course,
                    preferredTime: formData.scheduleTimeSlot,
                    status: 'pending',
                    createdAt: now
                });
            }

            // Registration complete: the student signs in through the official
            // login page. onboardingComplete:false makes the dashboard show the
            // Get Started guide once on their first sign-in.
            setPopup({
                isOpen: true,
                type: 'success',
                title: 'Registration Successful',
                message: 'Your pre-enrollment account has been created. A verification email was sent to ' + formData.email + ' — please verify your email address. Then sign in to the student portal to complete your Get Started guide and view your dashboard.'
            });

            setFormData({
                fullName: '',
                socialMediaLink: '',
                country: 'Philippines',
                countryCode: '+63',
                address: '',
                mobileNumber: '',
                wantCall: '',
                email: '',
                course: '',
                classSetup: '',
                scheduleTimeSlot: '',
                scheduleDays: '',
                japaneseKnowledge: '',
                purpose: '',
                password: '',
                confirmPassword: ''
            });
            setAgreed(false);

            // Reset all states
            setFieldErrors({});
            setAssessmentSubmitted(false);
            setAssessmentStarted(false);
            setAssessmentAnswers({});
            setAssessmentScore(null);
            setEssayAnswer('');

        } catch (error) {
            let errorMessage = 'Registration failed. Please try again.';
            let errorTitle = 'Registration Error';

            if (error.code === 'auth/email-already-in-use') {
                errorTitle = 'Email Already in Use';
                errorMessage = 'The email address you entered is already registered. Please use a different email or sign in.';
            } else if (error.code === 'auth/weak-password') {
                errorTitle = 'Weak Password';
                errorMessage = 'The password is too weak. Please adhere to password requirements.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address.';
            } else {
                errorMessage = error.message;
            }

            setPopup({
                isOpen: true,
                type: 'error',
                title: errorTitle,
                message: errorMessage
            });
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    // Popup Component
    const Popup = () => {
        if (!popup.isOpen) return null;

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
                <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 transform transition-all scale-100 animate-popupIn">
                    <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-6 ${popup.type === 'success' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                        {popup.type === 'success' ? (
                            <CheckCircle size={32} className="text-green-600" />
                        ) : (
                            <div className="text-red-600 font-bold text-2xl">!</div>
                        )}
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{popup.title}</h3>
                        <p className="text-gray-500 mb-6">{popup.message}</p>
                        {popup.type === 'success' ? (
                            <button
                                onClick={() => { window.location.href = '/UNMEIstudentsportal/login.html'; }}
                                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors inline-flex items-center justify-center gap-2"
                            >
                                <ArrowRight size={18} />
                                Go to Student Login
                            </button>
                        ) : (
                            <button
                                onClick={closePopup}
                                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
                            >
                                Try Again
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Toast Alert Component
    const ToastAlert = () => {
        if (!toast.isOpen) return null;

        return (
            <div className="fixed top-0 left-0 right-0 z-[110] flex justify-center p-4 pointer-events-none">
                <div className="bg-white rounded-xl shadow-2xl overflow-hidden animate-slideDown pointer-events-auto max-w-md w-full ring-1 ring-gray-100">
                    <div className="flex items-center p-4">
                        <div className="flex-shrink-0">
                            <AlertCircle className="h-5 w-5 text-red-500" size={20} />
                        </div>
                        <div className="ml-3 w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900">
                                Registration Error
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {toast.message}
                            </p>
                        </div>
                        <div className="ml-4 flex-shrink-0 flex">
                            <button
                                onClick={() => setToast({ isOpen: false, message: '' })}
                                className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                <span className="sr-only">Close</span>
                                <X className="h-5 w-5" size={20} />
                            </button>
                        </div>
                    </div>
                    {/* Timer Bar */}
                    <div className="h-1 bg-gray-100 w-full">
                        <div className="h-full bg-red-500 animate-timerShrink" style={{ '--toast-duration': '10s' }}></div>
                    </div>
                </div>
            </div>
        );
    };

    // Password Validation Logic
    const calculatePasswordStrength = (pass) => {
        let score = 0;
        const checks = {
            length: pass.length >= 8,
            upper: /[A-Z]/.test(pass),
            lower: /[a-z]/.test(pass),
            number: /[0-9]/.test(pass),
            special: /[^A-Za-z0-9]/.test(pass)
        };

        if (checks.length) score += 1;
        if (checks.upper) score += 1;
        if (checks.lower) score += 1;
        if (checks.number) score += 1;
        if (checks.special) score += 1;

        let level = 'Weak';
        let color = 'bg-red-500';
        if (score === 2) { level = 'Fair'; color = 'bg-orange-500'; }
        if (score === 3) { level = 'Good'; color = 'bg-yellow-500'; }
        if (score >= 4) { level = 'Strong'; color = 'bg-green-500'; }
        if (score === 5) { level = 'Very Strong'; color = 'bg-green-600'; }
        if (pass.length === 0) { level = ''; color = 'bg-gray-200'; }

        return { score, level, color, checks };
    };

    const pwdStrength = calculatePasswordStrength(formData.password);

    return (
        <div className="min-h-screen bg-[#F4F6F8]" style={{ fontFamily: "'Inter', sans-serif" }}>
            <Popup /> {/* Render Popup */}
            <ToastAlert /> {/* Render Top Toast */}

            {/* Assessment Modal - Inline to prevent scroll reset */}
            {showAssessment && currentAssessment && (
                <div
                    className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 scrollbar-hide"
                >
                    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-2xl w-full mx-4 my-auto">
                        {!assessmentStarted ? (
                            /* ── Start / Intro Screen ── */
                            <div className="text-center py-6 animate-fadeIn">
                                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <BookOpen size={36} className="text-red-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                                    Level Assessment
                                </h2>
                                <p className="text-lg font-semibold text-red-600 mb-4">{formData.course}</p>
                                <p className="text-gray-500 text-sm mb-8 max-w-md mx-auto leading-relaxed">
                                    Before enrolling in this course, we need to verify your current Japanese level.
                                    Please take a moment to answer a short assessment.
                                </p>

                                {/* Info Cards */}
                                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-10">
                                    <div className="bg-gray-50 rounded-2xl p-4">
                                        <p className="text-2xl font-bold text-gray-900">{currentAssessment.questions.length}</p>
                                        <p className="text-xs text-gray-500 mt-1">Questions</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-2xl p-4">
                                        <p className="text-2xl font-bold text-gray-900">{currentAssessment.passingScore}/{currentAssessment.questions.filter(q => q.type !== 'essay').length}</p>
                                        <p className="text-xs text-gray-500 mt-1">Passing Score</p>
                                    </div>
                                </div>

                                <div className="flex gap-3 max-w-sm mx-auto">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAssessment(false);
                                            setFormData(prev => ({ ...prev, course: '' }));
                                        }}
                                        className="flex-1 py-3.5 px-4 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
                                    >
                                        Go Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAssessmentStarted(true)}
                                        className="flex-1 py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg shadow-red-600/30 hover:shadow-red-600/40 transition-all"
                                    >
                                        Start Assessment
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* ── Actual Assessment Questions ── */
                            <div className="animate-fadeIn">
                                {/* Header */}
                                <div className="text-center mb-8">
                                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <BookOpen size={28} className="text-red-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        Level Assessment - {formData.course}
                                    </h2>
                                    <p className="text-gray-500 text-sm">
                                        Please answer the following questions to assess your current level.
                                        <br />Passing score: {currentAssessment.passingScore} / {currentAssessment.questions.filter(q => q.type !== 'essay').length} (excluding essay)
                                    </p>
                                </div>

                                {/* Questions */}
                                <div className="space-y-6">
                                    {currentAssessment.questions.map((q, index) => (
                                        <div key={q.id} className="bg-gray-50 rounded-2xl p-5">
                                            <p className="font-semibold text-gray-900 mb-4">
                                                <span className="inline-flex items-center justify-center w-7 h-7 bg-red-100 text-red-600 rounded-full text-sm mr-3">{index + 1}</span>
                                                {q.question}
                                            </p>

                                            {q.type === 'essay' ? (
                                                <textarea
                                                    value={essayAnswer}
                                                    onChange={(e) => setEssayAnswer(e.target.value)}
                                                    placeholder="Write your answer here..."
                                                    className="w-full p-4 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 resize-none"
                                                    rows={4}
                                                />
                                            ) : (
                                                <div className="space-y-2">
                                                    {q.options.map((option) => (
                                                        <div
                                                            key={option.key}
                                                            onClick={() => handleAnswerSelect(q.id, option.key)}
                                                            className={`w-full p-4 text-left rounded-xl border-2 transition-all cursor-pointer ${assessmentAnswers[q.id] === option.key
                                                                ? 'border-red-500 bg-red-50 text-red-700'
                                                                : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                                                                }`}
                                                        >
                                                            <span className="font-semibold mr-3 uppercase">{option.key}.</span>
                                                            {option.text}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Actions */}
                                <div className="mt-8 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAssessment(false);
                                            setFormData(prev => ({ ...prev, course: '' }));
                                        }}
                                        className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={submitAssessment}
                                        disabled={!currentAssessment.questions.every(q =>
                                            q.type === 'essay' ? essayAnswer.trim().length > 0 : assessmentAnswers[q.id]
                                        )}
                                        className={`flex-1 py-3 px-4 rounded-xl text-white font-semibold transition-colors ${currentAssessment.questions.every(q =>
                                            q.type === 'essay' ? essayAnswer.trim().length > 0 : assessmentAnswers[q.id]
                                        )
                                            ? 'bg-red-600 hover:bg-red-700'
                                            : 'bg-gray-300 cursor-not-allowed'
                                            }`}
                                    >
                                        Submit Assessment
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Official header banner (from the stable version / official
                Pre-Enrollment form) — the image IS the page header */}
            <header className="w-full shadow-md">
                <img
                    src={preenrollHeader}
                    alt="UNMEI NIHONGO CENTER - Pre-Enrollment"
                    className="w-full h-auto object-cover max-h-64 md:max-h-80"
                />
            </header>

            {/* Full-width login access band — separate from the form card,
                spans the whole page, text and button on one aligned row */}
            <div className="w-full bg-red-50/80 border-b border-red-100">
                <div className="max-w-5xl mx-auto px-4 md:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                        <span className="text-sm font-medium text-red-900">Already registered or have an existing student account?</span>
                    </div>
                    <a
                        href="/UNMEIstudentsportal/login.html"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-white hover:bg-red-50 px-4 py-2 rounded-full shadow-sm border border-red-200 transition-all hover:scale-105 shrink-0"
                    >
                        Sign In to Portal &rarr;
                    </a>
                </div>
            </div>

            {/* Back to website — keep this available for every registration entry point. */}
            {(() => {
                let showBack = true;
                try {
                    const params = new URLSearchParams(window.location.search);
                    showBack = params.get('intent') !== 'embedded';
                } catch (e) { showBack = true; }
                if (!showBack) return null;
                return (
                    <div className="max-w-5xl mx-auto w-full px-4 md:px-6 pt-5">
                        <a
                            href="/UNMEIwebsite/index.html"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 hover:border-red-400 hover:text-red-600 rounded-full px-4 py-2 shadow-sm transition-colors"
                        >
                            <ArrowLeft size={15} />
                            Back to UNMEI website
                        </a>
                    </div>
                );
            })()}

            {/* Main Content */}
            <main className="flex items-start justify-center pt-8 pb-12 px-4 md:px-6">
                <div className="w-full max-w-5xl">
                    {/* Form Card */}
                    <div className="bg-white border border-gray-100 rounded-[32px] shadow-xl shadow-gray-200/50 overflow-hidden">

                        {/* Header Section */}
                        <div className="px-8 pt-8 pb-4 md:px-12 bg-white text-center">
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1.5 tracking-tight">
                                PRE-ENROLLMENT FORM
                            </h1>
                            <p className="text-red-600 font-semibold text-sm md:text-base">
                                UNMEI NIHONGO CENTER
                            </p>
                            <p className="text-gray-500 text-xs md:text-sm mt-1">
                                Please fill in all required fields marked with <span className="text-red-500 font-bold">*</span>
                            </p>
                        </div>

                        {/* Card Body */}
                        <div className="px-8 pb-12 md:px-12 space-y-8">
                            {/* Message Alert removed in favor of Popup */}

                            {/* Two Column Layout for Desktop */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                                {/* Left Column: Personal Info */}
                                <div className="lg:col-span-7 space-y-8">
                                    <div className="space-y-6">
                                        <h2 className="flex items-center text-sm font-bold text-gray-900 uppercase tracking-wider">
                                            <span className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center mr-3 text-xs">01</span>
                                            Personal Details
                                        </h2>

                                        {/* Full Name */}
                                        <div className="group">
                                            <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Full Name<span className="text-red-500 ml-1">*</span></label>
                                            <div className="relative">
                                                <User size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${fieldErrors.fullName ? 'text-red-500' : 'text-gray-400 group-focus-within:text-red-500'}`} />
                                                <input
                                                    type="text"
                                                    name="fullName"
                                                    value={formData.fullName}
                                                    onChange={handleChange}
                                                    onKeyPress={handleKeyPress}
                                                    className={`w-full pl-12 pr-4 py-3.5 bg-gray-50 border rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-4 transition-all duration-200 ${fieldErrors.fullName ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-100 focus:border-red-500 focus:ring-red-500/10'}`}
                                                    placeholder="Enter your full name"
                                                />
                                            </div>
                                            {fieldErrors.fullName && <p className="mt-1.5 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.fullName}</p>}
                                        </div>

                                        {/* Facebook Profile Link */}
                                        <div className="group">
                                            <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Facebook Profile Link<span className="text-red-500 ml-1">*</span></label>
                                            <p className="text-xs text-gray-500 mb-2 ml-1">Your Facebook profile so we can also reach you there. i.e. fb.com/unmeinihongocenter</p>
                                            <div className="relative">
                                                <Link2 size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${fieldErrors.socialMediaLink ? 'text-red-500' : 'text-gray-400 group-focus-within:text-red-500'}`} />
                                                <input
                                                    type="text"
                                                    name="socialMediaLink"
                                                    value={formData.socialMediaLink}
                                                    onChange={handleChange}
                                                    onKeyPress={handleKeyPress}
                                                    className={`w-full pl-12 pr-4 py-3.5 bg-gray-50 border rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-4 transition-all duration-200 ${fieldErrors.socialMediaLink ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-100 focus:border-red-500 focus:ring-red-500/10'}`}
                                                    placeholder="e.g. facebook.com/juan.delacruz"
                                                />
                                            </div>
                                            {fieldErrors.socialMediaLink && <p className="mt-1.5 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.socialMediaLink}</p>}
                                        </div>

                                        {/* Country & Mobile */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            {/* Country Dropdown */}
                                            <div className="group relative">
                                                <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Country<span className="text-red-500 ml-1">*</span></label>
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                                                        className={`w-full pl-12 pr-10 py-3.5 bg-gray-50 border rounded-2xl text-left text-gray-800 focus:outline-none focus:bg-white focus:ring-4 transition-all duration-200 flex items-center gap-3 ${fieldErrors.country ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-100 focus:border-red-500 focus:ring-red-500/10'}`}
                                                    >
                                                        <Globe size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                                        {formData.country ? (
                                                            <>
                                                                <span>{formData.country}</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-400">Select country</span>
                                                        )}
                                                    </button>
                                                    <ChevronDown size={20} className={`absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />

                                                    {/* Dropdown */}
                                                    {showCountryDropdown && (
                                                        <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden">
                                                            <div className="p-2 border-b border-gray-100">
                                                                <input
                                                                    type="text"
                                                                    value={countrySearch}
                                                                    onChange={(e) => setCountrySearch(e.target.value)}
                                                                    placeholder="Search country..."
                                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-red-500"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                            <div className="max-h-48 overflow-y-auto">
                                                                {filteredCountries.map((country) => (
                                                                    <button
                                                                        key={country.name}
                                                                        type="button"
                                                                        onClick={() => handleCountrySelect(country)}
                                                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                                                                    >
                                                                        <span className="text-gray-800">{country.name}</span>
                                                                        <span className="ml-auto text-sm text-gray-400">{country.code}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {fieldErrors.country && <p className="mt-1.5 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.country}</p>}
                                            </div>

                                            {/* Mobile with Country Code */}
                                            <div className="group">
                                                <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Mobile Number<span className="text-red-500 ml-1">*</span></label>
                                                <div className="flex">
                                                    <div className={`flex items-center gap-1.5 px-4 py-3.5 bg-gray-100 border border-r-0 rounded-l-2xl text-gray-700 font-medium text-sm shrink-0 ${fieldErrors.mobileNumber ? 'border-red-500' : 'border-gray-200'}`}>
                                                        <span className="text-xs tracking-wide text-gray-500">CODE</span>
                                                        <span className="font-semibold">{formData.countryCode}</span>
                                                    </div>
                                                    <div className="relative flex-1 min-w-0">
                                                        <Phone size={20} className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${fieldErrors.mobileNumber ? 'text-red-500' : 'text-gray-400 group-focus-within:text-red-500'}`} />
                                                        <input
                                                            type="tel"
                                                            name="mobileNumber"
                                                            value={formData.mobileNumber}
                                                            onChange={handleChange}
                                                            onKeyPress={handleKeyPress}
                                                            className={`w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-l-0 rounded-r-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-4 transition-all duration-200 ${fieldErrors.mobileNumber ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-red-500 focus:ring-red-500/10'}`}
                                                            placeholder={formData.countryCode === '+63' ? '9XX XXX XXXX' : 'Mobile number'}
                                                        />
                                                    </div>
                                                </div>
                                                {fieldErrors.mobileNumber && <p className="mt-1.5 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.mobileNumber}</p>}
                                            </div>

                                            {/* Want Call Preference */}
                                            <div className="group md:col-span-2 mt-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Do you want us to call you?<span className="text-red-500 ml-1">*</span></label>
                                                <div className="text-sm text-gray-600 mb-4 ml-1 space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                                    <p>Here's our registered number:</p>
                                                    <p className="font-bold italic text-gray-800">0965-155-1397</p>
                                                    <p className="font-bold italic text-gray-800">0921-483-8791</p>
                                                    <p className="mt-2">If yes, please expect us to call you as soon as possible.</p>
                                                </div>
                                                <div className={`flex flex-col gap-3 p-1 rounded-2xl ${fieldErrors.wantCall ? 'ring-1 ring-red-500 ring-offset-2' : ''}`}>
                                                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${formData.wantCall === 'yes' ? 'border-red-500 bg-red-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                                        <input
                                                            type="radio"
                                                            name="wantCall"
                                                            value="yes"
                                                            checked={formData.wantCall === 'yes'}
                                                            onChange={handleChange}
                                                            className="w-5 h-5 text-red-600 border-gray-300 focus:ring-red-600"
                                                        />
                                                        <span className="text-gray-800 font-medium">Yes</span>
                                                    </label>
                                                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${formData.wantCall === 'no' ? 'border-red-500 bg-red-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                                        <input
                                                            type="radio"
                                                            name="wantCall"
                                                            value="no"
                                                            checked={formData.wantCall === 'no'}
                                                            onChange={handleChange}
                                                            className="w-5 h-5 text-red-600 border-gray-300 focus:ring-red-600"
                                                        />
                                                        <span className="text-gray-800 font-medium">No</span>
                                                    </label>
                                                </div>
                                                {fieldErrors.wantCall && <p className="mt-2 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.wantCall}</p>}
                                            </div>
                                        </div>

                                        {/* Address */}
                                        <div className="group">
                                            <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Complete Address<span className="text-red-500 ml-1">*</span></label>
                                            <div className="relative">
                                                <MapPin size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${fieldErrors.address ? 'text-red-500' : 'text-gray-400 group-focus-within:text-red-500'}`} />
                                                <input
                                                    type="text"
                                                    name="address"
                                                    value={formData.address}
                                                    onChange={handleChange}
                                                    onKeyPress={handleKeyPress}
                                                    className={`w-full pl-12 pr-4 py-3.5 bg-gray-50 border rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-4 transition-all duration-200 ${fieldErrors.address ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-100 focus:border-red-500 focus:ring-red-500/10'}`}
                                                    placeholder="Street, City, Province"
                                                />
                                            </div>
                                            {fieldErrors.address && <p className="mt-1.5 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.address}</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Account & Course */}
                                <div className="lg:col-span-5 space-y-8">
                                    {/* Account Info */}
                                    <div className="space-y-6">
                                        <h2 className="flex items-center text-sm font-bold text-gray-900 uppercase tracking-wider">
                                            <span className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center mr-3 text-xs">02</span>
                                            Account Security
                                        </h2>

                                        <div className="group">
                                            <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Email Address<span className="text-red-500 ml-1">*</span></label>
                                            <div className="relative">
                                                <Mail size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${fieldErrors.email ? 'text-red-500' : 'text-gray-400 group-focus-within:text-red-500'}`} />
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleChange}
                                                    onKeyPress={handleKeyPress}
                                                    className={`w-full pl-12 pr-4 py-3.5 bg-gray-50 border rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-4 transition-all duration-200 ${fieldErrors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-100 focus:border-red-500 focus:ring-red-500/10'}`}
                                                    placeholder="yourname@gmail.com"
                                                />
                                            </div>
                                            {fieldErrors.email && <p className="mt-1.5 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.email}</p>}
                                        </div>

                                        <div className="group">
                                            <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Password<span className="text-red-500 ml-1">*</span></label>
                                            <div className="relative">
                                                <Lock size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${fieldErrors.password ? 'text-red-500' : 'text-gray-400 group-focus-within:text-red-500'}`} />
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    name="password"
                                                    value={formData.password}
                                                    onChange={handleChange}
                                                    onKeyPress={handleKeyPress}
                                                    className={`w-full pl-12 pr-12 py-3.5 bg-gray-50 border rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-4 transition-all duration-200 ${fieldErrors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-100 focus:border-red-500 focus:ring-red-500/10'}`}
                                                    placeholder="Use strong password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                                >
                                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                                </button>
                                            </div>
                                            {fieldErrors.password && <p className="mt-1.5 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.password}</p>}

                                            {/* Real-time Password Strength Meter */}
                                            {formData.password.length > 0 && (
                                                <div className="mt-3 bg-gray-50 border border-gray-100 rounded-xl p-4 animate-fadeIn">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-sm font-medium text-gray-700">Password Strength</span>
                                                        <span className={`text-xs font-bold ${pwdStrength.level === 'Weak' ? 'text-red-500' : pwdStrength.level === 'Fair' ? 'text-orange-500' : pwdStrength.level === 'Good' ? 'text-yellow-500' : 'text-green-600'}`}>
                                                            {pwdStrength.level}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-1 mb-3">
                                                        {[...Array(5)].map((_, i) => (
                                                            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < pwdStrength.score ? pwdStrength.color : 'bg-gray-200'}`} />
                                                        ))}
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 text-xs text-gray-500">
                                                        <div className="flex items-center gap-1.5">
                                                            {pwdStrength.checks.length ? <Check size={14} className="text-green-500" /> : <X size={14} className="text-gray-300" />}
                                                            <span className={pwdStrength.checks.length ? 'text-gray-700' : ''}>Min 8 characters</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {pwdStrength.checks.upper ? <Check size={14} className="text-green-500" /> : <X size={14} className="text-gray-300" />}
                                                            <span className={pwdStrength.checks.upper ? 'text-gray-700' : ''}>Uppercase letter</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {pwdStrength.checks.lower ? <Check size={14} className="text-green-500" /> : <X size={14} className="text-gray-300" />}
                                                            <span className={pwdStrength.checks.lower ? 'text-gray-700' : ''}>Lowercase letter</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {pwdStrength.checks.number ? <Check size={14} className="text-green-500" /> : <X size={14} className="text-gray-300" />}
                                                            <span className={pwdStrength.checks.number ? 'text-gray-700' : ''}>Number</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {pwdStrength.checks.special ? <Check size={14} className="text-green-500" /> : <X size={14} className="text-gray-300" />}
                                                            <span className={pwdStrength.checks.special ? 'text-gray-700' : ''}>Special character</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="group">
                                            <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Confirm Password<span className="text-red-500 ml-1">*</span></label>
                                            <div className="relative">
                                                <Lock size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${fieldErrors.confirmPassword ? 'text-red-500' : 'text-gray-400 group-focus-within:text-red-500'}`} />
                                                <input
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    name="confirmPassword"
                                                    value={formData.confirmPassword}
                                                    onChange={handleChange}
                                                    onKeyPress={handleKeyPress}
                                                    className={`w-full pl-12 pr-12 py-3.5 bg-gray-50 border rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-4 transition-all duration-200 ${fieldErrors.confirmPassword ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-100 focus:border-red-500 focus:ring-red-500/10'}`}
                                                    placeholder="Re-enter password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                                >
                                                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                                </button>
                                            </div>
                                            {fieldErrors.confirmPassword && <p className="mt-1.5 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.confirmPassword}</p>}

                                            {/* Confirm Password Match Indicator */}
                                            {formData.confirmPassword.length > 0 && (
                                                <div className="mt-2 ml-1 flex items-center gap-1.5 animate-fadeIn">
                                                    {formData.password === formData.confirmPassword ? (
                                                        <>
                                                            <CheckCircle size={14} className="text-green-500" />
                                                            <span className="text-xs font-medium text-green-600">Passwords match</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <X size={14} className="text-red-500" />
                                                            <span className="text-xs font-medium text-red-500">Passwords do not match</span>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Course Selection */}
                                    <div className="space-y-6 pt-2">
                                        <h2 className="flex items-center text-sm font-bold text-gray-900 uppercase tracking-wider">
                                            <span className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center mr-3 text-xs">03</span>
                                            Course Preference
                                        </h2>

                                        <div className="grid grid-cols-1 gap-5">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Select Course<span className="text-red-500 ml-1">*</span></label>
                                                <div className="relative">
                                                    <BookOpen size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${fieldErrors.course ? 'text-red-500' : 'text-gray-400'}`} />
                                                    <select
                                                        name="course"
                                                        value={formData.course}
                                                        onChange={handleChange}
                                                        className={`w-full pl-12 pr-10 py-3.5 bg-gray-50 border rounded-2xl text-gray-800 focus:outline-none focus:bg-white focus:ring-4 transition-all duration-200 appearance-none cursor-pointer ${fieldErrors.course ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-100 focus:border-red-500 focus:ring-red-500/10'}`}
                                                    >
                                                        <option value="">Select a course</option>
                                                        {courseOptions.map((course) => (
                                                            <option key={course} value={course}>{course}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                                </div>
                                                {fieldErrors.course && <p className="mt-1.5 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.course}</p>}
                                            </div>

                                            {/* Assessment Status Indicator */}
                                            {requiresAssessment && (
                                                <div className={`mt-3 p-3 rounded-xl flex items-center gap-3 ${assessmentSubmitted
                                                    ? (currentAssessment && assessmentScore >= currentAssessment.passingScore
                                                        ? 'bg-green-50 border border-green-200'
                                                        : 'bg-red-50 border border-red-200')
                                                    : 'bg-amber-50 border border-amber-200'
                                                    }`}>
                                                    {assessmentSubmitted ? (
                                                        currentAssessment && assessmentScore >= currentAssessment.passingScore ? (
                                                            <>
                                                                <CheckCircle size={20} className="text-green-600 shrink-0" />
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-semibold text-green-800">Assessment Passed</p>
                                                                    <p className="text-xs text-green-600">
                                                                        Score: {assessmentScore} / {currentAssessment?.questions.filter(q => q.type !== 'essay').length} - You may proceed with enrollment
                                                                    </p>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                                                                    <X size={12} className="text-white" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-semibold text-red-800">Assessment Not Passed</p>
                                                                    <p className="text-xs text-red-600">
                                                                        Score: {assessmentScore} / {currentAssessment?.questions.filter(q => q.type !== 'essay').length} (Need {currentAssessment?.passingScore} to pass). Please select N5 or a bundle course.
                                                                    </p>
                                                                </div>
                                                            </>
                                                        )
                                                    ) : (
                                                        <>
                                                            <div className="w-5 h-5 rounded-full border-2 border-amber-500 flex items-center justify-center shrink-0">
                                                                <span className="text-amber-600 text-xs font-bold">!</span>
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-sm font-semibold text-amber-800">Level Assessment Required</p>
                                                                <p className="text-xs text-amber-600">Complete the assessment to proceed with enrollment</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowAssessment(true)}
                                                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
                                                            >
                                                                Take Now
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Class Setup<span className="text-red-500 ml-1">*</span></label>
                                                <div className="relative">
                                                    <Monitor size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${fieldErrors.classSetup ? 'text-red-500' : 'text-gray-400'}`} />
                                                    <select
                                                        name="classSetup"
                                                        value={formData.classSetup}
                                                        onChange={handleChange}
                                                        className={`w-full pl-12 pr-10 py-3.5 bg-gray-50 border rounded-2xl text-gray-800 focus:outline-none focus:bg-white focus:ring-4 transition-all duration-200 appearance-none cursor-pointer ${fieldErrors.classSetup ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-100 focus:border-red-500 focus:ring-red-500/10'}`}
                                                    >
                                                        <option value="">Select class setup</option>
                                                        {classSetupOptions.map((setup) => (
                                                            <option key={setup} value={setup}>{setup}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                                </div>
                                                {fieldErrors.classSetup && <p className="mt-1.5 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.classSetup}</p>}
                                            </div>

                                            {/* Preferred Schedule Time Slot */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Preferred Schedule Time Slot<span className="text-red-500 ml-1">*</span></label>
                                                <div className="relative">
                                                    <Clock size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${fieldErrors.scheduleTimeSlot ? 'text-red-500' : 'text-gray-400'}`} />
                                                    <select
                                                        name="scheduleTimeSlot"
                                                        value={formData.scheduleTimeSlot}
                                                        onChange={handleChange}
                                                        className={`w-full pl-12 pr-10 py-3.5 bg-gray-50 border rounded-2xl text-gray-800 focus:outline-none focus:bg-white focus:ring-4 transition-all duration-200 appearance-none cursor-pointer ${fieldErrors.scheduleTimeSlot ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-100 focus:border-red-500 focus:ring-red-500/10'}`}
                                                    >
                                                        <option value="">Select time slot</option>
                                                        {(formData.scheduleDays === SATURDAY_DAYS
                                                            ? ['8am - 5pm (Sat Only)']
                                                            : ['8am - 12nn', '1pm - 5pm']
                                                        ).map((slot) => (
                                                            <option key={slot} value={slot}>{slot}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                                </div>
                                                {fieldErrors.scheduleTimeSlot && <p className="mt-1.5 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.scheduleTimeSlot}</p>}
                                            </div>

                                            {/* Preferred Schedule (Days) */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Preferred Schedule<span className="text-red-500 ml-1">*</span></label>
                                                <div className="relative">
                                                    <CalendarDays size={20} className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${fieldErrors.scheduleDays ? 'text-red-500' : 'text-gray-400'}`} />
                                                    <select
                                                        name="scheduleDays"
                                                        value={formData.scheduleDays}
                                                        onChange={handleChange}
                                                        className={`w-full pl-12 pr-10 py-3.5 bg-gray-50 border rounded-2xl text-gray-800 focus:outline-none focus:bg-white focus:ring-4 transition-all duration-200 appearance-none cursor-pointer ${fieldErrors.scheduleDays ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-100 focus:border-red-500 focus:ring-red-500/10'}`}
                                                    >
                                                        <option value="">Select schedule days</option>
                                                        {['Monday - Wednesday - Friday', 'Monday - Friday', 'Tuesday & Thursday', 'Saturday Only'].map((days) => (
                                                            <option key={days} value={days}>{days}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                                </div>
                                                {fieldErrors.scheduleDays && <p className="mt-1.5 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.scheduleDays}</p>}
                                            </div>

                                            {/* Japanese Knowledge */}
                                            <div className="mt-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Rate your knowledge of the Japanese language<span className="text-red-500 ml-1">*</span></label>
                                                <div className="text-sm text-gray-600 mb-4 ml-1 space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                                    <p>1. Zero/minimal knowledge</p>
                                                    <p>2. Intermediate (JLPT trainee/former trainee)</p>
                                                    <p>3. Advanced (N2-N1 Level)</p>
                                                </div>
                                                <div className={`py-6 px-4 sm:px-8 sm:py-8 rounded-2xl border bg-white flex w-full ${fieldErrors.japaneseKnowledge ? 'border-red-500 ring-1 ring-red-500 ring-offset-1' : 'border-gray-100 shadow-sm'}`}>
                                                    <div className="flex items-start justify-between w-full">
                                                        {/* Beginner Label */}
                                                        <div className="flex flex-col items-center gap-4">
                                                            <span className="text-sm font-medium text-gray-700">Beginner</span>
                                                            <div className="w-5 h-5 invisible"></div>
                                                        </div>

                                                        {/* Number Options Drop */}
                                                        <div className="flex gap-8 sm:gap-14 shrink-0">
                                                            <label className="flex flex-col items-center gap-4 cursor-pointer group">
                                                                <span className="text-sm font-medium text-gray-700">1</span>
                                                                <input type="radio" name="japaneseKnowledge" value="beginner" checked={formData.japaneseKnowledge === 'beginner'} onChange={handleChange} className="w-5 h-5 text-blue-500 border-gray-400 focus:ring-blue-500 cursor-pointer" />
                                                            </label>
                                                            <label className="flex flex-col items-center gap-4 cursor-pointer group">
                                                                <span className="text-sm font-medium text-gray-700">2</span>
                                                                <input type="radio" name="japaneseKnowledge" value="intermediate" checked={formData.japaneseKnowledge === 'intermediate'} onChange={handleChange} className="w-5 h-5 text-blue-500 border-gray-400 focus:ring-blue-500 cursor-pointer" />
                                                            </label>
                                                            <label className="flex flex-col items-center gap-4 cursor-pointer group">
                                                                <span className="text-sm font-medium text-gray-700">3</span>
                                                                <input type="radio" name="japaneseKnowledge" value="advanced" checked={formData.japaneseKnowledge === 'advanced'} onChange={handleChange} className="w-5 h-5 text-blue-500 border-gray-400 focus:ring-blue-500 cursor-pointer" />
                                                            </label>
                                                        </div>

                                                        {/* Advanced Label */}
                                                        <div className="flex flex-col items-center gap-4">
                                                            <span className="text-sm font-medium text-gray-700">Advanced</span>
                                                            <div className="w-5 h-5 invisible"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                {fieldErrors.japaneseKnowledge && <p className="mt-2 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.japaneseKnowledge}</p>}
                                            </div>

                                            {/* Purpose */}
                                            <div className="group mt-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Purpose for studying Japanese<span className="text-red-500 ml-1">*</span></label>
                                                <div className="relative">
                                                    <Target size={20} className={`absolute left-4 top-4 pointer-events-none ${fieldErrors.purpose ? 'text-red-500' : 'text-gray-400 group-focus-within:text-red-500'}`} />
                                                    <textarea
                                                        name="purpose"
                                                        value={formData.purpose}
                                                        onChange={handleChange}
                                                        rows="3"
                                                        className={`w-full pl-12 pr-4 py-4 bg-gray-50 border rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-4 transition-all duration-200 resize-none ${fieldErrors.purpose ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-100 focus:border-red-500 focus:ring-red-500/10'}`}
                                                        placeholder="e.g. Preparing for JLPT certification, employment in Japan, or academic study"
                                                    />
                                                </div>
                                                {fieldErrors.purpose && <p className="mt-1.5 ml-1 text-xs font-semibold text-red-500 animate-fadeIn">{fieldErrors.purpose}</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Registration Agreement */}
                            <div id="regAgreementCard" className={`mt-2 p-4 sm:p-5 rounded-2xl border-2 bg-gray-50/70 transition-colors ${agreed ? 'border-green-300' : 'border-gray-200'}`}>
                                <label className="flex items-start gap-3 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={agreed}
                                        onChange={(e) => setAgreed(e.target.checked)}
                                        className="mt-0.5 w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                                    />
                                    <span className="text-sm text-gray-700 leading-relaxed">
                                        I confirm that the information I provided is true and correct, and I agree that UNMEI Nihongo Center may use it to process my enrollment and contact me about my classes and payments.
                                    </span>
                                </label>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-6">
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className={`w-full py-4 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white text-base font-bold rounded-2xl shadow-lg shadow-red-600/30 transition-all duration-200 ${loading ? 'opacity-70 cursor-not-allowed transform-none' : 'hover:shadow-red-600/40'
                                        }`}
                                >
                                    {loading ? 'Processing Enrollment...' : 'Submit Enrollment Application'}
                                </button>
                                <p className="mt-6 text-center text-xs text-gray-400 font-medium">
                                    Your information is stored securely and used for enrollment processing only.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
