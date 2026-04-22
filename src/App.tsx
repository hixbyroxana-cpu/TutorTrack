import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, Outlet } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Plus, Users, ChevronRight, BookOpen, BrainCircuit, ArrowLeft, Loader2, Target, Sparkles, Compass, Lightbulb, PenTool, Edit3, RotateCcw, FileText, CheckCircle2, Circle } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { store, Student, Lesson, Target as TargetType } from './db/store';
import { AudioRecorder } from '@/components/AudioRecorder';
import { AudioTargetRecorder } from '@/components/AudioTargetRecorder';
import { generateFocusSuggestion, generateRevisionStarter, generateMonthlyReport } from './ai/assistant';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { marked } from 'marked';

function Dashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    const data = await store.getStudents();
    setStudents(data);
  };

  const handleAddStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await store.saveStudent({
      name: fd.get('name') as string,
      age: fd.get('age') as string,
      level: fd.get('level') as string,
      curriculum: fd.get('curriculum') as string,
    });
    setIsAddOpen(false);
    loadStudents();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Active Students</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Manage all your private tutoring sessions.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="bg-indigo-600 text-white px-4 py-2 rounded font-semibold text-sm hover:bg-indigo-700 shadow-none" />}>
            <Plus className="w-4 h-4 mr-2" /> New Student
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
              <DialogDescription>Enter the student's details to start tracking their progress.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddStudent} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" name="name" required placeholder="e.g. Alex Johnson" className="rounded" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Age/Grade</Label>
                  <Input id="age" name="age" required placeholder="e.g. 14 / Grade 9" className="rounded" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">Level</Label>
                  <Input id="level" name="level" required placeholder="e.g. Intermediate" className="rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="curriculum">Curriculum / Goal</Label>
                <Input id="curriculum" name="curriculum" required placeholder="e.g. AP Calc / SAT Prep" className="rounded" />
              </div>
              <Button type="submit" className="w-full mt-6 rounded shadow-none font-bold bg-slate-900 hover:bg-slate-800">Save Student</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {students.length === 0 ? (
        <Card className="rounded border border-slate-200 shadow-none bg-white">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <Users className="w-12 h-12 text-slate-400 mb-4 opacity-50" />
            <h3 className="font-semibold text-xl text-slate-900">No students yet</h3>
            <p className="text-slate-500 mt-2 max-w-sm mb-6 pb-2 text-sm">Add your first student to start logging your tutoring sessions.</p>
            <Button className="bg-indigo-600 text-white px-6 py-2 rounded text-sm font-bold shadow-none hover:bg-indigo-700" onClick={() => setIsAddOpen(true)}>
              Get Started
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map(student => (
            <Link key={student.id} to={`/student/${student.id}`}>
              <Card className="rounded border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shadow-none overflow-hidden h-full border-l-4 border-l-transparent hover:border-l-indigo-600">
                <CardHeader className="p-6">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-900 mb-1">{student.name}</span>
                    <span className="text-xs text-slate-500 uppercase">{student.age} • {student.curriculum}</span>
                    <div className="mt-2 text-xs font-semibold text-indigo-600">{student.level}</div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [targets, setTargets] = useState<TargetType[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [revision, setRevision] = useState<string | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('voice');
  const [aiLoading, setAiLoading] = useState(false);

  // Form states for log
  const [progress, setProgress] = useState('');
  const [topics, setTopics] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [manualTargets, setManualTargets] = useState('');

  // Target Add state
  const [isAddTargetOpen, setIsAddTargetOpen] = useState(false);
  const [activeTargetTab, setActiveTargetTab] = useState('voice');
  const [newTargetTitle, setNewTargetTitle] = useState('');

  // Report state
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Edit states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editLessonId, setEditLessonId] = useState<string | null>(null);
  const [editProgress, setEditProgress] = useState('');
  const [editTopics, setEditTopics] = useState('');
  const [editNextSteps, setEditNextSteps] = useState('');

  useEffect(() => {
    if (isLogOpen) {
      setActiveTab('voice');
      setProgress('');
      setTopics('');
      setNextSteps('');
      setManualTargets('');
    }
  }, [isLogOpen]);

  useEffect(() => {
    if (isAddTargetOpen) {
      setActiveTargetTab('voice');
      setNewTargetTitle('');
    }
  }, [isAddTargetOpen]);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const loadData = async (studentId: string) => {
    const s = await store.getStudent(studentId);
    if (s) setStudent(s);
    const l = await store.getLessons(studentId);
    setLessons(l);
    const t = await store.getTargets(studentId);
    setTargets(t);
    
    // Auto-generate suggestion if we have lessons
    if (s && l.length > 0) {
      setAiLoading(true);
      try {
        const [aiSug, aiRev] = await Promise.all([
          generateFocusSuggestion(s, l, t),
          generateRevisionStarter(s, l)
        ]);
        setSuggestion(aiSug);
        setRevision(aiRev);
      } catch (err) {
        console.error("AI Error", err);
      } finally {
        setAiLoading(false);
      }
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    
    await store.saveLesson({
      studentId: id,
      date: Date.now(),
      progress,
      topicsCovered: topics,
      nextSteps
    });

    if (manualTargets.trim()) {
      const targetItems = manualTargets.split('\n').filter(t => t.trim());
      for (const t of targetItems) {
        await store.saveTarget({
          studentId: id,
          title: t.trim(),
          status: 'active'
        });
      }
    }

    setProgress('');
    setTopics('');
    setNextSteps('');
    setManualTargets('');
    setIsLogOpen(false);
    loadData(id);
  };

  const handleOpenEdit = (lesson: Lesson) => {
    setEditLessonId(lesson.id);
    setEditTopics(lesson.topicsCovered);
    setEditProgress(lesson.progress);
    setEditNextSteps(lesson.nextSteps || '');
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLessonId || !id) return;
    await store.updateLesson(editLessonId, {
      topicsCovered: editTopics,
      progress: editProgress,
      nextSteps: editNextSteps
    });
    setIsEditOpen(false);
    setEditLessonId(null);
    loadData(id); // Reload data and trigger AI suggestion generation based on updated lesson
  };

  const handleAudioLog = async (log: any) => {
    setProgress(log.progress);
    setTopics(log.topicsCovered);
    setNextSteps(log.nextSteps);
    if (log.newTargets && log.newTargets.length > 0) {
      setManualTargets(log.newTargets.join('\n'));
    }
    setActiveTab('manual');
  };

  const handleAudioTarget = async (title: string) => {
    setNewTargetTitle(title);
    setActiveTargetTab('manual');
  };

  const handleAddTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newTargetTitle.trim()) return;
    await store.saveTarget({
      studentId: id,
      title: newTargetTitle.trim(),
      status: 'active'
    });
    setNewTargetTitle('');
    setIsAddTargetOpen(false);
    loadData(id);
  };

  const toggleTargetStatus = async (target: TargetType) => {
    if (!id) return;
    const newStatus = target.status === 'active' ? 'completed' : 'active';
    await store.updateTarget(target.id, {
      status: newStatus,
      completedAt: newStatus === 'completed' ? Date.now() : undefined
    });
    loadData(id);
  };

  const handleGenerateReport = async () => {
    if (!student || !id) return;
    setIsReportOpen(true);
    setReportLoading(true);
    try {
      // Get last 30 days of lessons
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const recentLessons = lessons.filter(l => l.date >= thirtyDaysAgo);
      const report = await generateMonthlyReport(student, recentLessons, targets);
      setReportText(report);
    } catch (err) {
      console.error(err);
      setReportText("Failed to generate report.");
    } finally {
      setReportLoading(false);
    }
  };

  if (!student) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex items-center space-x-2 text-sm text-slate-600 font-semibold mb-4">
        <Link to="/" className="hover:text-indigo-600 transition-colors flex items-center"><ArrowLeft className="w-4 h-4 mr-1"/> Back to Dashboard</Link>
      </div>

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 bg-white p-6 rounded border border-slate-200">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-slate-900">{student.name}</h2>
          <p className="text-slate-500 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
            <span>Age: {student.age}</span>
            <span>Level: {student.level}</span>
            <span>Curriculum: {student.curriculum}</span>
          </p>
        </div>

        <div className="flex flex-row flex-nowrap items-center gap-2">
          <Dialog open={isAddTargetOpen} onOpenChange={setIsAddTargetOpen}>
            <DialogTrigger render={<Button className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 border disabled:opacity-50 px-3 py-1.5 h-auto text-xs font-bold shadow-none border-indigo-100 transition-colors" />}>
              <Target className="w-3.5 h-3.5 mr-1" />
              Add Target
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded p-0 overflow-hidden max-h-[90vh] flex flex-col">
              <div className="p-6 pb-0 flex-shrink-0">
                <DialogHeader>
                  <DialogTitle>Add New Target</DialogTitle>
                  <DialogDescription>Record or type a specific goal or struggle area you want to track.</DialogDescription>
                </DialogHeader>
              </div>
              <Tabs value={activeTargetTab} onValueChange={setActiveTargetTab} className="w-full flex-1 flex flex-col overflow-hidden">
                <div className="px-6 pt-4 flex-shrink-0">
                  <TabsList className="grid w-full grid-cols-2 rounded p-1 bg-slate-100">
                    <TabsTrigger value="voice" className="rounded-sm outline-none">Voice Record</TabsTrigger>
                    <TabsTrigger value="manual" className="rounded-sm outline-none">Manual Type</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="voice" className="p-6 mt-0">
                  <AudioTargetRecorder onTargetExtracted={handleAudioTarget} />
                </TabsContent>
                <TabsContent value="manual" className="p-6 mt-0 flex-1 overflow-y-auto">
                  <form onSubmit={handleAddTarget} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Target Description</Label>
                      <Input 
                        required 
                        value={newTargetTitle} 
                        onChange={e => setNewTargetTitle(e.target.value)} 
                        placeholder="e.g. Factoring polynomials"
                        className="rounded"
                      />
                    </div>
                    <Button type="submit" className="w-full mt-4 rounded shadow-none font-bold bg-slate-900 hover:bg-slate-800">Add Target</Button>
                  </form>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          <Button onClick={handleGenerateReport} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 border disabled:opacity-50 px-3 py-1.5 h-auto text-xs font-bold shadow-none border-indigo-100 transition-colors">
            <FileText className="w-3.5 h-3.5 mr-1" />
            Monthly Report
          </Button>

          <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
            <DialogTrigger render={<Button className="bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 h-auto text-xs font-bold shadow-none transition-colors border-none" />}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Log Session
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded p-0 overflow-hidden 
              max-h-[90vh] flex flex-col">
              <div className="p-6 pb-0 flex-shrink-0">
                <DialogHeader>
                  <DialogTitle className="text-2xl">Log Session</DialogTitle>
                  <DialogDescription>Record a voice memo or type out the session details.</DialogDescription>
                </DialogHeader>
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col overflow-hidden">
                <div className="px-6 pt-4 flex-shrink-0">
                  <TabsList className="grid w-full grid-cols-2 rounded p-1 bg-slate-100">
                    <TabsTrigger value="voice" className="rounded-sm outline-none">Voice Log</TabsTrigger>
                    <TabsTrigger value="manual" className="rounded-sm outline-none">Manual</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="voice" className="p-6 mt-0">
                  <AudioRecorder onLogExtracted={handleAudioLog} />
                </TabsContent>
                <TabsContent value="manual" className="p-6 mt-0 flex-1 overflow-y-auto">
                  <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Topics Covered</Label>
                      <Textarea 
                        required 
                        value={topics} 
                        onChange={e => setTopics(e.target.value)} 
                        placeholder="e.g. Worked on factoring quadratics"
                        className="resize-none h-16 rounded"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Progress / Observations</Label>
                      <Textarea 
                        required 
                        value={progress} 
                        onChange={e => setProgress(e.target.value)}
                        placeholder="e.g. Struggled with signs initially but improved."
                        className="resize-none h-16 rounded"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>New Targets / Struggles (Optional)</Label>
                      <Textarea 
                        value={manualTargets} 
                        onChange={e => setManualTargets(e.target.value)}
                        placeholder="List items, one per line (e.g. Expanding polynomials)"
                        className="resize-none h-16 rounded"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Next Steps / Homework</Label>
                      <Textarea 
                        required 
                        value={nextSteps} 
                        onChange={e => setNextSteps(e.target.value)}
                        placeholder="e.g. Textbook pg 142 evens. Review graphing next time."
                        className="resize-none h-16 rounded"
                      />
                    </div>
                    <Button type="submit" className="w-full mt-6 rounded shadow-none font-bold bg-slate-900 hover:bg-slate-800" size="lg">Save Log</Button>
                  </form>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>

          <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
          <DialogContent className="sm:max-w-[600px] rounded p-8 report-dialog-content">
            <DialogHeader className="no-print">
              <DialogTitle className="text-2xl">Monthly Progress Report</DialogTitle>
              <DialogDescription>A summary of {student.name}'s progress over the last 30 days.</DialogDescription>
            </DialogHeader>
            <div id="printable-report" className="pdf-export-safe mt-4 prose prose-sm max-w-none p-6 rounded border h-[300px] overflow-y-auto print:h-auto print:border-none print:shadow-none print:bg-white print:overflow-visible">
              {reportLoading ? (
                <div className="flex flex-col items-center justify-center py-12 no-print">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
                  <p className="text-sm font-medium text-slate-500 animate-pulse">Drafting report with AI...</p>
                </div>
              ) : (
                <div className="markdown-body">
                  {reportText && <Markdown>{reportText}</Markdown>}
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3 no-print">
              <Button onClick={() => {
                if (reportText) {
                  navigator.clipboard.writeText(reportText);
                  alert('Copied to clipboard!');
                }
              }} variant="outline" className="text-slate-600 px-6 py-2 rounded font-bold shadow-none border-slate-200">
                Copy to Clipboard
              </Button>
              <Button onClick={() => {
                if (!reportText) return;

                // Create a beautiful off-screen HTML element
                const container = document.createElement('div');
                container.innerHTML = `
                  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; font-size: 13px; background: white;">
                    <div style="border-bottom: 3px solid #6366f1; padding-bottom: 15px; margin-bottom: 20px;">
                      <h1 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 800;">Monthly Progress Report</h1>
                      <div style="display: flex; justify-content: space-between; margin-top: 8px; color: #64748b; font-size: 12px;">
                        <span>Student: <strong>${student.name}</strong></span>
                        <span>Date: <strong>${format(new Date(), 'MMM d, yyyy')}</strong></span>
                      </div>
                    </div>
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.05); line-height: 1.5;">
                      ${marked.parse(reportText)}
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; text-align: center;">
                      <p>Prepared by Roxana Scurtu</p>
                    </div>
                  </div>
                `;
                
                // Add some basic styling for the markdown content
                const style = document.createElement('style');
                style.textContent = `
                  h2 { color: #1e293b; font-size: 16px; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; font-weight: 700; }
                  h3 { color: #334155; font-size: 14px; margin-top: 14px; margin-bottom: 6px; font-weight: 700; }
                  p { margin-bottom: 10px; }
                  ul { margin-top: 8px; margin-bottom: 14px; padding-left: 20px; list-style-type: disc; }
                  li { margin-bottom: 4px; }
                  strong { color: #0f172a; font-weight: 700; }
                `;
                container.appendChild(style);

                const opt = {
                  margin:       0.75,
                  filename:     `${student.name}-monthly-report.pdf`,
                  image:        { type: 'jpeg', quality: 0.98 },
                  html2canvas:  { scale: 2, useCORS: true },
                  jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
                };
                
                html2pdf().set(opt).from(container).save();
              }} className="bg-slate-900 text-white px-6 py-2 rounded font-bold shadow-none hover:bg-slate-800">
                Export to PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[500px] rounded p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl">Edit Session Log</DialogTitle>
              <DialogDescription>Update the details of this lesson.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Topics Covered</Label>
                <Textarea 
                  required 
                  value={editTopics} 
                  onChange={e => setEditTopics(e.target.value)} 
                  className="resize-none h-20 rounded"
                />
              </div>
              <div className="space-y-2">
                <Label>Progress / Observations</Label>
                <Textarea 
                  required 
                  value={editProgress} 
                  onChange={e => setEditProgress(e.target.value)}
                  className="resize-none h-20 rounded"
                />
              </div>
              <div className="space-y-2">
                <Label>Next Steps / Homework</Label>
                <Textarea 
                  required 
                  value={editNextSteps} 
                  onChange={e => setEditNextSteps(e.target.value)}
                  className="resize-none h-20 rounded"
                />
              </div>
              <Button type="submit" className="w-full mt-6 rounded shadow-none font-bold bg-slate-900 hover:bg-slate-800" size="lg">Save Changes</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lesson History</h4>
          </div>
          
          {lessons.length === 0 ? (
            <Card className="rounded border border-slate-200 shadow-none bg-white">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <BookOpen className="w-10 h-10 text-muted-foreground mb-4 opacity-50" />
                <h3 className="font-medium text-lg">No sessions logged</h3>
                <p className="text-muted-foreground mt-1 text-sm">Add a session log to track {student.name}'s progress.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {lessons.map((lesson, index) => {
                const icons = [BookOpen, Target, Sparkles, Compass, Lightbulb, PenTool];
                const IconComponent = icons[index % icons.length];
                
                return (
                <Card key={lesson.id} className="rounded border border-slate-200 shadow-none overflow-hidden bg-white mb-4 relative group">
                  <CardContent className="p-4 md:p-6 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded border border-indigo-100 bg-indigo-50/50 shadow-sm flex items-center justify-center text-indigo-500">
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <span className="inline-block bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded shadow-sm">
                          {format(lesson.date, 'MMM do, yyyy')}
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleOpenEdit(lesson)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Topics Covered</h5>
                      <p className="text-sm leading-relaxed text-slate-700">{lesson.topicsCovered}</p>
                    </div>
                    <Separator className="bg-slate-200" />
                    <div>
                      <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Progress</h5>
                      <p className="text-sm leading-relaxed text-slate-700">{lesson.progress}</p>
                    </div>
                    {lesson.nextSteps && (
                      <>
                        <Separator className="bg-slate-200" />
                        <div className="bg-indigo-50/50 p-4 rounded border border-indigo-100">
                          <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Next Steps</h5>
                          <p className="text-sm text-indigo-900 leading-relaxed font-medium">{lesson.nextSteps}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="border border-slate-200 p-6 rounded bg-white">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                <Target className="w-3.5 h-3.5 mr-2" /> Targets
              </h4>
            </div>

            {targets.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No targets listed.</p>
            ) : (
              <ul className="space-y-3">
                {targets.map(target => (
                  <li key={target.id} className="flex flex-row items-start gap-3">
                    <button onClick={() => toggleTargetStatus(target)} className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors flex-shrink-0">
                      {target.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <span className={`text-sm ${target.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800 font-medium'}`}>
                      {target.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-2 border-slate-300 p-8 rounded-lg shadow-sm bg-white flex flex-col relative overflow-hidden">
            <h4 className="flex items-center text-sm font-bold text-slate-800 uppercase tracking-widest mb-4 border-b border-slate-200 pb-3">
              <RotateCcw className="w-4 h-4 mr-2.5 text-indigo-500" />
              Whiteboard: Revision Starter
            </h4>
            {lessons.length === 0 ? (
              <div className="text-sm text-slate-400 py-2">
                Log a lesson to get revision ideas.
              </div>
            ) : aiLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : (
              <div className="prose prose-slate max-w-none text-slate-900 *:my-2 bg-white rounded-md text-base sm:text-lg w-full leading-relaxed tracking-wide">
                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {revision || "Could not generate revision starter."}
                </Markdown>
              </div>
            )}
          </div>

          <div className="border border-indigo-100 p-6 rounded bg-indigo-50/50">
            <h4 className="flex items-center text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              Smart Suggestion
            </h4>
            {lessons.length === 0 ? (
              <div className="text-sm text-indigo-400/80 py-2">
                Log a lesson to get suggestions.
              </div>
            ) : aiLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              </div>
            ) : (
              <p className="text-indigo-900 font-medium mb-2 leading-relaxed">
                {suggestion || "Could not generate suggestion."}
              </p>
            )}
          </div>
          
          {lessons.length > 0 && lessons[0].nextSteps && (
            <div className="border border-slate-200 p-6 rounded bg-white">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Next Steps & Reminders</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 border-2 border-slate-300 rounded mt-0.5 max-w-5"></div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-800">{lessons[0].nextSteps}</span>
                    <span className="text-xs text-slate-500 mt-1">Carryover from {format(lessons[0].date, 'MMM do')}</span>
                  </div>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Layout() {
  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 font-sans selection:bg-indigo-600/20 selection:text-indigo-900">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-sm flex items-center justify-center">
              <div className="w-4 h-4 bg-white"></div>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">TUTOR<span className="text-indigo-600">TRACK</span></span>
          </Link>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/student/:id" element={<StudentDetails />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
