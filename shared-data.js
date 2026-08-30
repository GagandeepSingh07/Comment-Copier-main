const STORAGE_KEY = 'comment-copier-data-v7';
const PROMPT_KEY = 'comment-copier-prompt-v1';
const SHEET_KEY = 'comment-copier-sheet-v3';
const LAYOUT_KEY = 'comment-copier-layout-v1';
const ORGANIZER_KEY = 'comment-copier-organizer-path-v1';
const DATE_FIRST_KEY = 'comment-copier-date-first-v1';
const THEME_KEY = 'comment-copier-theme-v1';
const ACCENT_KEY = 'comment-copier-accent-v1';
const HOTKEY_KEY = 'comment-copier-hotkey-v1';
const CONFIRM_DELETE_KEY = 'comment-copier-confirm-delete-v1';
const LAST_STUDENT_KEY = 'comment-copier-last-student-v1';
const CLOSE_AFTER_COPY_KEY = 'comment-copier-close-after-copy-v1';
const AUTO_CHECK_UPDATES_KEY = 'comment-copier-auto-check-updates-v1';
const ROLLBACK_KEY = 'comment-copier-rollback-v1';
const RESTORE_MODE_KEY = 'comment-copier-restore-mode-v1';
const REDUCE_MOTION_KEY = 'comment-copier-reduce-motion-v1';
const TOOLTIP_DENSITY_KEY = 'comment-copier-tooltip-density-v1';
const UPDATE_CHANNEL_KEY = 'comment-copier-update-channel-v1';
const LANG_KEY = 'comment-copier-lang-v1';

// The three app-wide, in-window keyboard shortcuts (Comment Editor's
// add-comment/search focus, and the global backup action) are user-
// rebindable; their current bindings live under this key. The Ctrl+Enter
// (save) and Enter (add/confirm) shortcuts are contextual to specific
// fields and aren't part of this rebindable set.
const SHORTCUTS_KEY = 'comment-copier-shortcuts-v1';
const DEFAULT_SHORTCUTS = {
    addComment: 'Ctrl+N',
    search: 'Ctrl+F',
    backup: 'Ctrl+B',
    tabAccept: 'Ctrl+1',
    tabAireject: 'Ctrl+2',
    tabCopyreject: 'Ctrl+3',
    tabPrompt: 'Ctrl+4',
};
const SHORTCUT_LABELS = {
    addComment: 'Focus the add-comment box',
    search: 'Focus the search box',
    backup: 'Back up your data',
    tabAccept: 'Set popup layout to Cards',
    tabAireject: 'Set popup layout to Tabs',
    tabCopyreject: 'Set popup layout to Side by side',
    tabPrompt: 'Cycle to the next popup layout',
};

// Per-comment usage counters live under a separate storage key so a full
// restore/backup of the editor data doesn't get tangled with them.
const USAGE_KEY = 'comment-copier-usage-v1';

const SHEET_ASSESSMENT_COLS = 9;

const SHEET_BORDER = '0.5pt solid';

const SHEET_COLORS = {
    header: '#92CDDC',
    headerText: '#000000',
    border: '#000000',
    code: '#DAEEF3',
    status: '#D8E4BC',
    divider: '#EEECE1',
};

const MARK_COLORS = {
    'Checked': '#C6E0B4',
    'AI Detected': '#F4B7B7',
    'Copied': '#FFFF00',
};
const MARK_COLOR_DEFAULT = '#D9D9D9';

function markColor(status) {
    return MARK_COLORS[status] || MARK_COLOR_DEFAULT;
}

const defaultSheetData = {
    studentId: '',
    name: '',
    codes: [],
};

const defaultPrompt = `**TASK:**
Create named folders in the target directory based on file names. The folder name should be the code/identifier extracted from the file's name. Then move each file into its corresponding folder.

**RULES:**
1. Read the directory to identify all files.
2. For each file, extract the folder name using this logic:
   - If the filename contains a "-", take all text before the first "-".
   - If no "-", take only the first word (code/identifier before the first space).
3. Trim any leading/trailing whitespace from the folder name.
4. Remove "final" or "Final" from the end of the folder name (if present).
5. If multiple files share the same extracted name, create only one folder.
6. Create the folder if it doesn't already exist.
7. Move each file into its corresponding folder:
   - Do NOT rename or modify the file itself (filename stays identical).
   - If the destination folder already contains a file with the same name, do not overwrite it \u2014 skip that file (or append a numeric suffix) and report it.
8. Do NOT modify, rename, or alter the contents of any file.


**EXAMPLES:**
- File: "CPCCCA3002 - Assessment.v1.0.docx"
- Folder created: \`CPCCCA3002/\`, file moved to \`CPCCCA3002/CPCCCA3002 - Assessment.v1.0.docx\`


- File: "CPCCWHS2001 - Assessment.v1.0 (1).docx"
- Folder created: \`CPCCWHS2001/\`, file moved to \`CPCCWHS2001/CPCCWHS2001 - Assessment.v1.0 (1).docx\`


- File: "BSBESB303 final.docx"
- Folder created: \`BSBESB303/\`, file moved to \`BSBESB303/BSBESB303 final.docx\`


- File: "CPCCWHS2001 Unit Assessment Pack Version 9(Final).docx"
- Folder created: \`CPCCWHS2001/\`, file moved to \`CPCCWHS2001/CPCCWHS2001 Unit Assessment Pack Version 9(Final).docx\`


**USAGE:**
Provide this prompt along with the target directory path and ask the AI to create the folders and move the files accordingly.`;

const defaultAccept = [
    "The student followed the assignment instructions carefully and produced work that met the expected standard.",
    "The submitted work demonstrates a clear understanding of the task and satisfies the key assessment requirements.",
    "The student addressed all required components effectively, resulting in work that meets the expected level of achievement.",
    "The assignment was completed accurately and in line with the stated requirements, reflecting a sound understanding of the expectations.",
    "The student's submission meets the learning outcomes and demonstrates appropriate attention to the assessment guidelines.",
    "The work reflects a competent approach to the task, with clear evidence that the required criteria have been achieved.",
    "The student demonstrated a good understanding of the assignment expectations and completed the task to the required standard.",
    "The submission is well aligned with the assessment requirements and successfully addresses the key assessment criteria.",
    "The student produced work of an acceptable standard, meeting the objectives and expectations of the assessment.",
    "The assignment was completed in a structured and appropriate manner, fulfilling the specified requirements.",
    "The student's work demonstrates satisfactory achievement of the assessment outcomes and complies with the required expectations.",
    "The submission effectively responds to the task and provides evidence that the assessment criteria have been successfully addressed.",
    "The student presented the required content clearly and completed the assignment according to the given instructions.",
    "The work demonstrates an appropriate application of the knowledge and skills required to complete the task.",
    "The student has shown a satisfactory ability to understand the purpose of the assignment and respond appropriately.",
    "The submission covers the essential aspects of the task and demonstrates a suitable level of academic engagement.",
    "The work provides sufficient evidence of the student's ability to apply the relevant concepts effectively.",
    "The student has interpreted the assignment brief correctly and addressed the topic in an appropriate manner.",
    "The submission is organised effectively, with the main elements of the task clearly presented.",
    "The assignment reflects a satisfactory level of effort and an appropriate approach to completing the required work.",
    "The student has included the necessary information and addressed the relevant areas of the task appropriately.",
    "The work demonstrates the student's ability to apply suitable methods and approaches to the assigned task.",
    "The submission shows satisfactory development and application of the knowledge required for the assessment.",
    "The student has communicated the relevant ideas clearly and maintained an appropriate focus on the task.",
    "The assignment demonstrates a suitable balance between accuracy, organisation, and completion.",
    "The submitted work reflects a responsible approach to the assessment and appropriate attention to quality.",
    "The student has completed the task with sufficient detail to demonstrate achievement of the intended objectives.",
    "The work demonstrates a satisfactory level of engagement with the subject and the requirements of the assignment.",
    "The submission is relevant to the assignment brief and provides an appropriate response to the given task.",
    "The student has successfully completed the assessment and demonstrated achievement of the essential objectives.",
];

const defaultAiReject = [
    "The submission appears to be AI-generated and does not demonstrate the student's own work.",
    "The assignment shows clear signs of AI-generated text and requires review.",
    "The response was detected as likely AI-written and must be revised.",
    "The submission was flagged for potential AI use and needs to be revised.",
    "The text of the submission appears to be produced by an AI tool rather than the student.",
    "The assignment reads as AI-generated and lacks the student's own analysis.",
    "The submission shows typical patterns of AI writing and requires the student to redo it.",
    "The work does not reflect the student's own effort and appears AI-generated.",
    "The response was flagged by AI detection tools as machine-written.",
    "The submission seems to have been written by an AI and must be completed again by the student.",
    "The assignment is not written in the student's own words and appears AI-generated.",
    "The submission was identified as AI-generated content and needs to be revised.",
    "The submitted work contains indications of AI-generated content and should be rewritten by the student.",
    "The response raises concerns regarding the use of AI and requires resubmission in the student's own words.",
    "The writing style and content suggest that the submission may not represent the student's original work.",
    "The assignment requires further review because the submitted content shows characteristics commonly associated with AI-generated writing.",
    "The work should be redone to ensure that it reflects the student's own understanding and independent effort.",
    "The submission contains patterns that indicate possible AI assistance and cannot be accepted in its current form.",
    "The content does not provide sufficient evidence of the student's individual authorship and requires revision.",
    "The response should be rewritten independently, as the current submission raises concerns about AI-generated content.",
    "The assignment displays characteristics inconsistent with original student writing and requires the student's own revision.",
    "The submission cannot be accepted in its current form due to concerns regarding the originality of the written content.",
    "The work requires resubmission with content that clearly demonstrates the student's personal understanding of the topic.",
    "The assignment shows substantial indicators of machine-generated writing and should be completed again independently.",
    "The current response does not sufficiently demonstrate independent student authorship and requires revision.",
    "The submission should be revised to ensure that the ideas and explanations are presented in the student's own language.",
    "The content raises concerns about the authenticity of the student's work and requires a revised submission.",
    "The assignment needs to be rewritten to demonstrate the student's individual knowledge and understanding of the subject.",
    "The response shows possible reliance on AI-generated material and should be revised before it can be accepted.",
    "The submitted work requires revision because it does not clearly establish that the content was independently produced by the student.",
];

const defaultCopyReject = [
    "The content is highly similar to existing online sources and may have been copied.",
    "The response closely matches content from other sources without proper attribution.",
    "The work appears to have been copied from another student's submission.",
    "The text closely resembles published content and lacks originality.",
    "The assignment contains content copied from other sources.",
    "The work shows signs of plagiarism and must be rewritten by the student.",
    "The submission is too similar to another source to be considered original.",
    "Large parts of the assignment were copied directly from an existing source.",
    "The submission was detected as copied from another student's work.",
    "The response duplicates content found online without citing the source.",
    "The assignment is not the student's original work and appears to be copied.",
    "The submission matches existing material too closely and needs to be rewritten.",
    "The submitted content shows a significant similarity to material available from other sources and requires revision.",
    "The assignment raises concerns about originality because portions of the work closely match previously existing content.",
    "The response includes material that appears to have been reproduced without sufficient acknowledgment of the original source.",
    "The work cannot be accepted in its current form because it does not demonstrate sufficient originality.",
    "The submission contains similarities to external material that require the student to rewrite the work independently.",
    "The assignment appears to rely heavily on previously published or submitted content rather than original student work.",
    "The content requires revision because the level of similarity to existing sources raises concerns about plagiarism.",
    "The student's submission does not provide adequate evidence that the work was independently created.",
    "The response contains passages that closely correspond with material from other sources and should be rewritten.",
    "The assignment should be resubmitted with original content written independently by the student.",
    "The submitted work raises concerns regarding copied material and requires substantial revision before acceptance.",
    "The content appears insufficiently original and should be rewritten using the student's own understanding and expression.",
    "The response contains material that may have been taken from another source without appropriate citation or acknowledgment.",
    "The work demonstrates an unacceptable level of similarity to existing content and cannot be accepted as original.",
    "The assignment requires revision to ensure that the final submission reflects the student's own original work.",
    "The submission includes content that closely resembles other available material and should be revised for originality.",
    "The work should be rewritten independently, as the current submission raises concerns about the source and originality of the content.",
    "The assignment cannot be approved because significant portions appear to be based on copied or previously existing material.",
];

const categories = ['accept', 'aireject', 'copyreject'];
const LABELS = { accept: 'Accept', aireject: 'AI Reject', copyreject: 'Copy Reject' };
const DEFAULTS = { accept: defaultAccept, aireject: defaultAiReject, copyreject: defaultCopyReject };

// Comments may contain personalisation placeholders like {name} or {unit},
// which are substituted before copying. When a real value isn't available the
// raw token is left in place. The popup substitutes from the current Student
// Details; sample values are used only for the editor's live preview.
const PLACEHOLDER_ALIASES = {
    name: ['name', 'student', 'studentname'],
    unit: ['unit', 'code', 'unitcode', 'assessment'],
};
const PLACEHOLDER_SAMPLE = { name: 'Student', unit: 'CPCCCA3019' };

function placeholderTokens(text) {
    const out = [];
    const re = /\{([^}]+)\}/g;
    let m;
    while ((m = re.exec(text))) out.push(m[1]);
    return out;
}

function resolvePlaceholder(token, values) {
    const key = token.trim().toLowerCase();
    const v = values || {};
    if (v[key] !== undefined && v[key] !== '') return String(v[key]);
    for (const alias of PLACEHOLDER_ALIASES.name) if (key === alias && v.name) return String(v.name);
    for (const alias of PLACEHOLDER_ALIASES.unit) if (key === alias && v.unit) return String(v.unit);
    return null;
}

function substitutePlaceholders(text, values) {
    return text.replace(/\{([^}]+)\}/g, (whole, token) => {
        const resolved = resolvePlaceholder(token, values);
        return resolved === null ? whole : resolved;
    });
}
