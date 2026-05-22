#!/usr/bin/env node
// Run 150 test cases against /api/hybrid-career-match and report accuracy.
// Each case has a profile + acceptable top-3 career titles.

const BASE = process.env.API_BASE || `http://localhost:${process.env.PORT || 5000}`;

const CASES = [
  // ─── Software Developer (1-7) ────────────────────────────────────────────
  { skills: ['JavaScript', 'Python', 'Programming'], interests: ['Technology'], expect: ['Software Developer'] },
  { skills: ['Java', 'Programming', 'Problem Solving'], interests: ['Technology', 'Engineering'], expect: ['Software Developer'] },
  { skills: ['Programming', 'JavaScript', 'Critical Thinking'], interests: ['Technology'], expect: ['Software Developer'] },
  { skills: ['Python', 'Programming'], interests: ['Technology', 'Data'], expect: ['Software Developer', 'Data Scientist'] },
  { skills: ['React', 'TypeScript', 'JavaScript'], interests: ['Technology'], expect: ['Software Developer'] },
  { skills: ['Programming', 'Systems Analysis', 'Quality Control Analysis'], interests: ['Technology'], expect: ['Software Developer'] },
  { skills: ['C++', 'Programming', 'Problem Solving'], interests: ['Technology'], expect: ['Software Developer'] },

  // ─── Data Scientist (8-13) ───────────────────────────────────────────────
  { skills: ['Machine Learning', 'Python', 'Statistics'], interests: ['Technology', 'Data'], expect: ['Data Scientist'] },
  { skills: ['Data Analysis', 'Statistics', 'Python'], interests: ['Data', 'Technology'], expect: ['Data Scientist'] },
  { skills: ['Machine Learning', 'Data Analysis', 'Programming'], interests: ['Data'], expect: ['Data Scientist'] },
  { skills: ['Statistics', 'R Programming', 'Data Analysis'], interests: ['Data', 'Research'], expect: ['Data Scientist'] },
  { skills: ['Data Analysis', 'Machine Learning', 'Critical Thinking'], interests: ['Healthcare', 'Data'], expect: ['Data Scientist'] },
  { skills: ['AI', 'Deep Learning', 'Python'], interests: ['Technology'], expect: ['Data Scientist', 'Software Developer'] },

  // ─── Registered Nurse (14-19) ────────────────────────────────────────────
  { skills: ['Patient Care', 'Active Listening', 'Monitoring'], interests: ['Healthcare'], expect: ['Registered Nurse'] },
  { skills: ['Nursing', 'Patient Care', 'Communication'], interests: ['Healthcare'], expect: ['Registered Nurse'] },
  { skills: ['Active Listening', 'Critical Thinking', 'Speaking'], interests: ['Healthcare'], expect: ['Registered Nurse'] },
  { skills: ['Patient Care', 'Reading Comprehension'], interests: ['Healthcare', 'Helping People'], expect: ['Registered Nurse'] },
  { skills: ['Nursing', 'Monitoring', 'Patient Care'], interests: ['Healthcare'], expect: ['Registered Nurse'] },
  { skills: ['Bedside Care', 'Active Listening'], interests: ['Healthcare'], expect: ['Registered Nurse'] },

  // ─── Civil Engineer (20-24) ──────────────────────────────────────────────
  { skills: ['Engineering Design', 'Mathematics', 'Project Management'], interests: ['Engineering'], expect: ['Civil Engineer'] },
  { skills: ['Engineering Design', 'Critical Thinking', 'Complex Problem Solving'], interests: ['Engineering'], expect: ['Civil Engineer', 'Mechanical Engineer'] },
  { skills: ['Mathematics', 'Engineering', 'Project Management'], interests: ['Engineering'], expect: ['Civil Engineer', 'Mechanical Engineer'] },
  { skills: ['Civil Engineering', 'Mathematics'], interests: ['Engineering'], expect: ['Civil Engineer'] },
  { skills: ['Structural', 'Mathematics', 'Engineering Design'], interests: ['Engineering'], expect: ['Civil Engineer'] },

  // ─── Marketing Manager (25-30) ───────────────────────────────────────────
  { skills: ['Marketing', 'Strategic Planning', 'Communication'], interests: ['Marketing'], expect: ['Marketing Manager'] },
  { skills: ['Marketing', 'Data Analysis', 'Project Management'], interests: ['Marketing', 'Business'], expect: ['Marketing Manager'] },
  { skills: ['Digital Marketing', 'SEO', 'Branding'], interests: ['Marketing'], expect: ['Marketing Manager'] },
  { skills: ['Marketing', 'Communication'], interests: ['Marketing', 'Creative'], expect: ['Marketing Manager'] },
  { skills: ['Strategic Planning', 'Marketing', 'Communication'], interests: ['Business', 'Marketing'], expect: ['Marketing Manager'] },
  { skills: ['Content Marketing', 'Social Media', 'Marketing'], interests: ['Marketing'], expect: ['Marketing Manager'] },

  // ─── Elementary School Teacher (31-35) ───────────────────────────────────
  { skills: ['Teaching', 'Active Listening', 'Speaking'], interests: ['Education'], expect: ['Elementary School Teacher'] },
  { skills: ['Teaching', 'Learning Strategies', 'Social Perceptiveness'], interests: ['Education'], expect: ['Elementary School Teacher'] },
  { skills: ['Teaching', 'Communication'], interests: ['Education', 'Helping People'], expect: ['Elementary School Teacher'] },
  { skills: ['Instruction', 'Active Listening'], interests: ['Education'], expect: ['Elementary School Teacher'] },
  { skills: ['Curriculum', 'Teaching', 'Speaking'], interests: ['Education'], expect: ['Elementary School Teacher'] },

  // ─── Financial Analyst (36-41) ───────────────────────────────────────────
  { skills: ['Financial Analysis', 'Mathematics', 'Excel'], interests: ['Finance'], expect: ['Financial Analyst'] },
  { skills: ['Finance', 'Data Analysis', 'Excel'], interests: ['Finance'], expect: ['Financial Analyst'] },
  { skills: ['Financial Analysis', 'Critical Thinking'], interests: ['Finance', 'Business'], expect: ['Financial Analyst'] },
  { skills: ['Accounting', 'Excel', 'Mathematics'], interests: ['Finance'], expect: ['Financial Analyst'] },
  { skills: ['Investment', 'Financial Analysis'], interests: ['Finance'], expect: ['Financial Analyst'] },
  { skills: ['Banking', 'Excel', 'Critical Thinking'], interests: ['Finance'], expect: ['Financial Analyst'] },

  // ─── Mechanical Engineer (42-46) ─────────────────────────────────────────
  { skills: ['CAD Software', 'Engineering Design', 'Mathematics'], interests: ['Engineering'], expect: ['Mechanical Engineer'] },
  { skills: ['Mechanical', 'CAD', 'Engineering Design'], interests: ['Engineering'], expect: ['Mechanical Engineer'] },
  { skills: ['CAD', 'Mathematics', 'Problem Solving'], interests: ['Engineering', 'Manufacturing'], expect: ['Mechanical Engineer'] },
  { skills: ['Mechanical Engineering', 'CAD', 'Critical Thinking'], interests: ['Engineering'], expect: ['Mechanical Engineer'] },
  { skills: ['Engineering Design', 'CAD', 'Manufacturing'], interests: ['Engineering', 'Manufacturing'], expect: ['Mechanical Engineer', 'Production Manager'] },

  // ─── Graphic Designer (47-52) ────────────────────────────────────────────
  { skills: ['Graphic Design', 'Creativity', 'Adobe Creative Suite'], interests: ['Arts', 'Creative'], expect: ['Graphic Designer'] },
  { skills: ['Design', 'Photoshop', 'Illustrator'], interests: ['Creative'], expect: ['Graphic Designer'] },
  { skills: ['Typography', 'Brand Development', 'Graphic Design'], interests: ['Creative'], expect: ['Graphic Designer'] },
  { skills: ['Visual Design', 'Creativity'], interests: ['Arts'], expect: ['Graphic Designer'] },
  { skills: ['Figma', 'UI', 'UX'], interests: ['Creative', 'Technology'], expect: ['Graphic Designer'] },
  { skills: ['Adobe Creative Suite', 'Design', 'Branding'], interests: ['Creative'], expect: ['Graphic Designer'] },

  // ─── Physical Therapist (53-57) ──────────────────────────────────────────
  { skills: ['Physical Therapy', 'Patient Care', 'Manual Therapy'], interests: ['Healthcare'], expect: ['Physical Therapist'] },
  { skills: ['Physical Therapy', 'Exercise Prescription', 'Assessment'], interests: ['Healthcare', 'Sports'], expect: ['Physical Therapist'] },
  { skills: ['Rehabilitation', 'Patient Care', 'Manual Therapy'], interests: ['Healthcare'], expect: ['Physical Therapist'] },
  { skills: ['Physical Therapy', 'Patient Care'], interests: ['Sports', 'Healthcare'], expect: ['Physical Therapist'] },
  { skills: ['Sports Medicine', 'Physical Therapy'], interests: ['Healthcare'], expect: ['Physical Therapist'] },

  // ─── Cybersecurity Specialist (58-63) ────────────────────────────────────
  { skills: ['Network Security', 'Penetration Testing', 'Firewall Management'], interests: ['Security', 'Technology'], expect: ['Cybersecurity Specialist'] },
  { skills: ['Cybersecurity', 'Risk Assessment', 'Incident Response'], interests: ['Security'], expect: ['Cybersecurity Specialist'] },
  { skills: ['Information Security', 'Network Security'], interests: ['Security'], expect: ['Cybersecurity Specialist'] },
  { skills: ['Ethical Hacking', 'Penetration Testing'], interests: ['Security', 'Technology'], expect: ['Cybersecurity Specialist'] },
  { skills: ['Cybersecurity', 'Incident Response', 'Firewall Management'], interests: ['Security'], expect: ['Cybersecurity Specialist'] },
  { skills: ['Network Security', 'Risk Assessment'], interests: ['Security', 'Technology'], expect: ['Cybersecurity Specialist'] },

  // ─── Human Resources Manager (64-68) ─────────────────────────────────────
  { skills: ['Human Resources', 'Leadership', 'Communication'], interests: ['Business'], expect: ['Human Resources Manager'] },
  { skills: ['HR', 'Conflict Resolution', 'Employment Law'], interests: ['Business'], expect: ['Human Resources Manager'] },
  { skills: ['Human Resources', 'Communication', 'Leadership'], interests: ['Business', 'Helping People'], expect: ['Human Resources Manager'] },
  { skills: ['Recruiting', 'Human Resources', 'Communication'], interests: ['Business'], expect: ['Human Resources Manager'] },
  { skills: ['HR', 'Leadership', 'Conflict Resolution'], interests: ['Business'], expect: ['Human Resources Manager'] },

  // ─── Occupational Therapist (69-73) ──────────────────────────────────────
  { skills: ['Occupational Therapy', 'Patient Assessment', 'Treatment Planning'], interests: ['Healthcare'], expect: ['Occupational Therapist'] },
  { skills: ['Occupational Therapy', 'Adaptive Equipment', 'Communication'], interests: ['Healthcare'], expect: ['Occupational Therapist'] },
  { skills: ['Treatment Planning', 'Patient Assessment'], interests: ['Healthcare'], expect: ['Occupational Therapist', 'Physical Therapist'] },
  { skills: ['Occupational Therapy', 'Patient Care'], interests: ['Healthcare', 'Helping People'], expect: ['Occupational Therapist'] },
  { skills: ['Adaptive Equipment', 'Occupational Therapy'], interests: ['Healthcare'], expect: ['Occupational Therapist'] },

  // ─── Pharmacist (74-78) ──────────────────────────────────────────────────
  { skills: ['Pharmaceutical Knowledge', 'Drug Interactions', 'Patient Counseling'], interests: ['Healthcare'], expect: ['Pharmacist'] },
  { skills: ['Pharmacy', 'Clinical Knowledge', 'Attention to Detail'], interests: ['Healthcare'], expect: ['Pharmacist'] },
  { skills: ['Pharmaceutical', 'Patient Counseling'], interests: ['Healthcare', 'Science'], expect: ['Pharmacist'] },
  { skills: ['Pharmacy', 'Drug Interactions'], interests: ['Healthcare'], expect: ['Pharmacist'] },
  { skills: ['Clinical Knowledge', 'Pharmaceutical Knowledge'], interests: ['Healthcare'], expect: ['Pharmacist'] },

  // ─── Environmental Engineer (79-83) ──────────────────────────────────────
  { skills: ['Environmental Engineering', 'Water Treatment', 'Air Quality'], interests: ['Environment', 'Engineering'], expect: ['Environmental Engineer'] },
  { skills: ['Waste Management', 'Environmental Regulations', 'Environmental Engineering'], interests: ['Environment'], expect: ['Environmental Engineer'] },
  { skills: ['Environmental', 'Engineering', 'Water Treatment'], interests: ['Environment'], expect: ['Environmental Engineer'] },
  { skills: ['Sustainability', 'Environmental Engineering'], interests: ['Environment', 'Engineering'], expect: ['Environmental Engineer'] },
  { skills: ['Air Quality', 'Environmental Regulations'], interests: ['Environment'], expect: ['Environmental Engineer'] },

  // ─── Speech-Language Pathologist (84-87) ─────────────────────────────────
  { skills: ['Speech Therapy', 'Language Assessment', 'Communication Disorders'], interests: ['Healthcare'], expect: ['Speech-Language Pathologist'] },
  { skills: ['Speech Therapy', 'Patient Care', 'Therapeutic Techniques'], interests: ['Healthcare'], expect: ['Speech-Language Pathologist'] },
  { skills: ['Communication Disorders', 'Language Assessment'], interests: ['Healthcare', 'Education'], expect: ['Speech-Language Pathologist'] },
  { skills: ['Speech Therapy', 'Therapeutic Techniques'], interests: ['Healthcare'], expect: ['Speech-Language Pathologist'] },

  // ─── Biomedical Engineer (88-92) ─────────────────────────────────────────
  { skills: ['Biomedical Engineering', 'Product Design', 'Research'], interests: ['Engineering', 'Science'], expect: ['Biomedical Engineer'] },
  { skills: ['Medical Device Development', 'Biomedical Engineering'], interests: ['Healthcare', 'Engineering'], expect: ['Biomedical Engineer'] },
  { skills: ['Biomedical', 'Research', 'Data Analysis'], interests: ['Science', 'Healthcare'], expect: ['Biomedical Engineer'] },
  { skills: ['Biomedical Engineering', 'Research'], interests: ['Engineering'], expect: ['Biomedical Engineer'] },
  { skills: ['Medical Devices', 'Product Design', 'Biomedical Engineering'], interests: ['Engineering'], expect: ['Biomedical Engineer'] },

  // ─── Social Worker (93-97) ───────────────────────────────────────────────
  { skills: ['Social Work', 'Counseling', 'Case Management'], interests: ['Social Work', 'Helping People'], expect: ['Social Worker'] },
  { skills: ['Crisis Intervention', 'Community Resources', 'Social Work'], interests: ['Nonprofit'], expect: ['Social Worker'] },
  { skills: ['Counseling', 'Case Management'], interests: ['Social Work', 'Healthcare'], expect: ['Social Worker'] },
  { skills: ['Social Work', 'Communication', 'Case Management'], interests: ['Helping People'], expect: ['Social Worker'] },
  { skills: ['Counseling', 'Social Work'], interests: ['Nonprofit', 'Social Work'], expect: ['Social Worker'] },

  // ─── Operations Research Analyst (98-101) ────────────────────────────────
  { skills: ['Operations Research', 'Mathematical Modeling', 'Optimization'], interests: ['Data', 'Business'], expect: ['Operations Research Analyst'] },
  { skills: ['Statistical Analysis', 'Operations Research', 'Data Analysis'], interests: ['Data'], expect: ['Operations Research Analyst', 'Data Scientist'] },
  { skills: ['Optimization', 'Mathematical Modeling'], interests: ['Business', 'Data'], expect: ['Operations Research Analyst'] },
  { skills: ['Operations Research', 'Data Analysis', 'Mathematics'], interests: ['Consulting'], expect: ['Operations Research Analyst'] },

  // ─── Dental Hygienist (102-105) ──────────────────────────────────────────
  { skills: ['Dental Hygiene', 'Oral Health Education', 'Preventive Care'], interests: ['Healthcare'], expect: ['Dental Hygienist'] },
  { skills: ['Dental Hygiene', 'Dental Radiography', 'Patient Care'], interests: ['Healthcare'], expect: ['Dental Hygienist'] },
  { skills: ['Dental', 'Patient Care', 'Preventive Care'], interests: ['Healthcare'], expect: ['Dental Hygienist'] },
  { skills: ['Oral Health Education', 'Dental Hygiene'], interests: ['Healthcare'], expect: ['Dental Hygienist'] },

  // ─── Production Manager (106-109) ────────────────────────────────────────
  { skills: ['Production Planning', 'Quality Control', 'Team Leadership'], interests: ['Manufacturing'], expect: ['Production Manager'] },
  { skills: ['Production Planning', 'Process Improvement', 'Problem Solving'], interests: ['Manufacturing'], expect: ['Production Manager'] },
  { skills: ['Manufacturing', 'Team Leadership', 'Production Planning'], interests: ['Manufacturing'], expect: ['Production Manager'] },
  { skills: ['Production', 'Quality Control', 'Leadership'], interests: ['Manufacturing'], expect: ['Production Manager'] },

  // ─── Quality Control Inspector (110-113) ─────────────────────────────────
  { skills: ['Quality Assurance', 'Attention to Detail', 'Measurement Tools'], interests: ['Manufacturing'], expect: ['Quality Control Inspector'] },
  { skills: ['Quality Control', 'Technical Reading', 'Documentation'], interests: ['Manufacturing'], expect: ['Quality Control Inspector'] },
  { skills: ['Quality Assurance', 'Attention to Detail', 'Documentation'], interests: ['Manufacturing'], expect: ['Quality Control Inspector'] },
  { skills: ['QA', 'Quality Control', 'Attention to Detail'], interests: ['Manufacturing'], expect: ['Quality Control Inspector'] },

  // ─── Retail Manager (114-117) ────────────────────────────────────────────
  { skills: ['Customer Service', 'Sales', 'Team Leadership'], interests: ['Retail', 'Business'], expect: ['Retail Manager', 'Sales Representative'] },
  { skills: ['Inventory Management', 'Visual Merchandising', 'Customer Service'], interests: ['Retail'], expect: ['Retail Manager'] },
  { skills: ['Customer Service', 'Team Leadership', 'Sales'], interests: ['Retail'], expect: ['Retail Manager'] },
  { skills: ['Retail', 'Customer Service', 'Inventory Management'], interests: ['Retail'], expect: ['Retail Manager'] },

  // ─── Sales Representative (118-121) ──────────────────────────────────────
  { skills: ['Sales', 'Negotiation', 'Customer Relationship Management'], interests: ['Business'], expect: ['Sales Representative'] },
  { skills: ['Sales', 'Communication', 'Presentation Skills'], interests: ['Business'], expect: ['Sales Representative'] },
  { skills: ['Selling', 'Negotiation', 'Communication'], interests: ['Business'], expect: ['Sales Representative'] },
  { skills: ['Sales', 'Customer Relationship Management'], interests: ['Business'], expect: ['Sales Representative'] },

  // ─── Management Consultant (122-126) ─────────────────────────────────────
  { skills: ['Strategic Planning', 'Data Analysis', 'Project Management'], interests: ['Consulting', 'Business'], expect: ['Management Consultant'] },
  { skills: ['Consulting', 'Problem Solving', 'Presentation Skills'], interests: ['Consulting'], expect: ['Management Consultant'] },
  { skills: ['Strategic Planning', 'Consulting', 'Data Analysis'], interests: ['Business'], expect: ['Management Consultant'] },
  { skills: ['Management Consulting', 'Strategy', 'Problem Solving'], interests: ['Consulting'], expect: ['Management Consultant'] },
  { skills: ['Project Management', 'Strategic Planning', 'Presentation Skills'], interests: ['Consulting'], expect: ['Management Consultant'] },

  // ─── Paralegal (127-131) ─────────────────────────────────────────────────
  { skills: ['Legal Research', 'Legal Writing', 'Document Preparation'], interests: ['Law'], expect: ['Paralegal'] },
  { skills: ['Legal', 'Document Preparation', 'Communication'], interests: ['Law'], expect: ['Paralegal'] },
  { skills: ['Legal Research', 'Critical Thinking'], interests: ['Law'], expect: ['Paralegal'] },
  { skills: ['Paralegal', 'Legal Writing'], interests: ['Law'], expect: ['Paralegal'] },
  { skills: ['Legal', 'Communication', 'Documentation'], interests: ['Law'], expect: ['Paralegal'] },

  // ─── Compliance Officer (132-136) ────────────────────────────────────────
  { skills: ['Compliance', 'Risk Assessment', 'Regulatory Knowledge'], interests: ['Law', 'Finance'], expect: ['Compliance Officer'] },
  { skills: ['Regulatory', 'Compliance', 'Audit'], interests: ['Finance'], expect: ['Compliance Officer'] },
  { skills: ['Compliance', 'Critical Thinking', 'Documentation'], interests: ['Law'], expect: ['Compliance Officer', 'Paralegal'] },
  { skills: ['Risk Assessment', 'Compliance', 'Communication'], interests: ['Finance', 'Law'], expect: ['Compliance Officer'] },
  { skills: ['Compliance', 'Regulatory'], interests: ['Government'], expect: ['Compliance Officer'] },

  // ─── Cross-domain & ambiguity tests (137-150) ─────────────────────────────
  // These probe that off-topic combinations DON'T return overconfident matches
  { skills: ['Python', 'Machine Learning', 'Data Analysis'], interests: ['Healthcare'], expect: ['Data Scientist'] },
  { skills: ['Communication', 'Leadership'], interests: ['Healthcare'], expect: ['Registered Nurse', 'Human Resources Manager', 'Social Worker'] },
  { skills: ['Communication', 'Writing'], interests: ['Marketing'], expect: ['Marketing Manager'] },
  { skills: ['Mathematics', 'Statistics'], interests: ['Finance'], expect: ['Financial Analyst', 'Operations Research Analyst'] },
  { skills: ['Project Management', 'Leadership'], interests: ['Manufacturing'], expect: ['Production Manager', 'Management Consultant'] },
  { skills: ['Excel', 'Data Analysis'], interests: ['Finance'], expect: ['Financial Analyst'] },
  { skills: ['Patient Care', 'Communication'], interests: ['Healthcare'], expect: ['Registered Nurse', 'Physical Therapist', 'Occupational Therapist', 'Pharmacist', 'Dental Hygienist', 'Speech-Language Pathologist'] },
  { skills: ['Engineering Design', 'Mathematics'], interests: ['Engineering'], expect: ['Civil Engineer', 'Mechanical Engineer', 'Environmental Engineer', 'Biomedical Engineer'] },
  { skills: ['Teaching', 'Communication'], interests: ['Education'], expect: ['Elementary School Teacher'] },
  { skills: ['Sales', 'Communication'], interests: ['Retail'], expect: ['Sales Representative', 'Retail Manager'] },
  { skills: ['Programming', 'Critical Thinking'], interests: ['Technology'], expect: ['Software Developer'] },
  { skills: ['Data Analysis', 'Programming'], interests: ['Finance'], expect: ['Financial Analyst', 'Data Scientist'] },
  { skills: ['Strategic Planning', 'Communication', 'Leadership'], interests: ['Business'], expect: ['Management Consultant', 'Marketing Manager', 'Human Resources Manager'] },
  { skills: ['Research', 'Critical Thinking', 'Data Analysis'], interests: ['Science'], expect: ['Data Scientist', 'Biomedical Engineer', 'Operations Research Analyst'] },
];

async function runOne(profile) {
  const res = await fetch(`${BASE}/api/hybrid-career-match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...profile, education: 'bachelor', timestamp: Date.now() }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function rank(careers, expectedSet) {
  for (let i = 0; i < careers.length; i++) {
    if (expectedSet.has(careers[i].career.title)) return i + 1; // 1-indexed
  }
  return -1;
}

async function main() {
  console.log(`\n🧪 Running ${CASES.length} career-match test cases against ${BASE}\n`);
  let top1 = 0, top3 = 0, top5 = 0, miss = 0;
  const failures = [];

  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const expected = new Set(c.expect);
    try {
      const r = await runOne({ skills: c.skills, interests: c.interests });
      const list = r?.data?.careerOptions || [];
      const r1 = rank(list, expected);
      if (r1 === 1) top1++;
      if (r1 >= 1 && r1 <= 3) top3++;
      if (r1 >= 1 && r1 <= 5) top5++;
      if (r1 === -1) {
        miss++;
        failures.push({
          idx: i + 1,
          skills: c.skills,
          interests: c.interests,
          expected: c.expect,
          got: list.slice(0, 5).map(o => `${o.career.title} (${o.career.topKConfidence}%)`),
        });
      } else if (r1 > 3) {
        failures.push({
          idx: i + 1,
          skills: c.skills,
          interests: c.interests,
          expected: c.expect,
          got: list.slice(0, 5).map(o => `${o.career.title} (${o.career.topKConfidence}%)`),
          rank: r1,
        });
      }
      process.stdout.write(r1 === 1 ? '✓' : r1 > 0 && r1 <= 3 ? '·' : '✗');
      if ((i + 1) % 50 === 0) process.stdout.write(`  ${i + 1}\n`);
    } catch (e) {
      miss++;
      failures.push({ idx: i + 1, error: e.message, skills: c.skills, interests: c.interests, expected: c.expect });
      process.stdout.write('!');
    }
  }
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(` RESULTS (${CASES.length} cases)`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log(` Top-1 accuracy: ${top1}/${CASES.length} = ${((top1/CASES.length)*100).toFixed(1)}%`);
  console.log(` Top-3 accuracy: ${top3}/${CASES.length} = ${((top3/CASES.length)*100).toFixed(1)}%`);
  console.log(` Top-5 accuracy: ${top5}/${CASES.length} = ${((top5/CASES.length)*100).toFixed(1)}%`);
  console.log(` Misses (no expected in top10): ${miss}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (failures.length > 0 && process.env.VERBOSE) {
    console.log('Failures detail:');
    for (const f of failures.slice(0, 30)) {
      console.log(`  #${f.idx} skills=${JSON.stringify(f.skills)} interests=${JSON.stringify(f.interests)}`);
      console.log(`     expected: ${JSON.stringify(f.expected)}`);
      console.log(`     got:      ${JSON.stringify(f.got)}${f.rank ? ` [rank ${f.rank}]` : ''}`);
    }
  } else if (failures.length > 0) {
    console.log(`(Set VERBOSE=1 to see ${failures.length} failure details)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
