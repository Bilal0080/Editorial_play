import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Home, 
  Sparkles, 
  History, 
  Wand2, 
  Plus, 
  Image as ImageIcon, 
  Users,
  Rocket,
  Castle,
  PawPrint,
  Upload,
  LogOut,
  LogIn,
  Edit2,
  Check,
  X,
  Share2,
  Compass,
  Ghost,
  Lightbulb,
  Zap,
  BookOpen,
  Camera,
  Smile,
  Palette,
  Mic,
  MicOff
} from 'lucide-react';
import { RECENT_STORIES, Story } from './types';
import { auth, db, storage } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateStory, generateStoryImage } from './lib/gemini';

export default function App() {
  const [prompt, setPrompt] = useState('Wolf Baby alone in the jungle...');
  const [stories, setStories] = useState<Story[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [isDraggingOverAddons, setIsDraggingOverAddons] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showShareToast, setShowShareToast] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<{ title: string; summary: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const STORY_STARTERS = [
    { label: 'The Lost Key', prompt: 'A golden key found in an old oak tree...', icon: Compass, color: 'bg-blue-50 text-blue-600' },
    { label: 'Mars Flower', prompt: 'A lonely robot finding a blue flower on Mars...', icon: Rocket, color: 'bg-orange-50 text-orange-600' },
    { label: 'Cat Detective', prompt: 'A detective who can talk to the neighborhood cats...', icon: Ghost, color: 'bg-purple-50 text-purple-600' },
    { label: 'Dragon Chill', prompt: 'A dragon who prefers ice cream over breathing fire...', icon: Castle, color: 'bg-green-50 text-green-600' },
    { label: 'Magic Library', prompt: 'A library where books come to life at night...', icon: BookOpen, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Time Watch', prompt: 'A watch that can stop time for five seconds...', icon: Zap, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Cloud City', prompt: 'A city built entirely on fluffy white clouds...', icon: Lightbulb, color: 'bg-cyan-50 text-cyan-600' },
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Sync user to Firestore
        setDoc(doc(db, 'users', currentUser.uid), {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
        }, { merge: true });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const storyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().createdAt?.toDate()?.toLocaleString() || 'Just now'
      })) as Story[];
      setStories(storyData.length > 0 ? storyData : RECENT_STORIES);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleSparkle = async (previewedData?: { title: string; summary: string }) => {
    if (!user) {
      alert("Please log in to create stories!");
      return;
    }
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setPreviewData(null); // Close preview if it was open
    try {
      const { title, summary } = previewedData || await generateStory(prompt, selectedTheme || undefined);
      const imageUrl = await generateStoryImage(prompt, selectedTheme || undefined, selectedStyle || undefined);

      if (imageUrl) {
        // Convert base64 to blob and upload to Firebase Storage
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const storageRef = ref(storage, `stories/${Date.now()}.png`);
        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);

        await addDoc(collection(db, 'stories'), {
          title,
          description: summary,
          imageUrl: downloadUrl,
          category: selectedTheme ? selectedTheme.toUpperCase() : 'AI GENERATED',
          authorId: user.uid,
          createdAt: serverTimestamp(),
          style: selectedStyle || 'Default'
        });
      }
      setPrompt('');
      setSelectedTheme(null);
      setSelectedStyle(null);
    } catch (error) {
      console.error("Story generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `uploads/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      
      // Use the uploaded image as a prompt for a new story
      const { title, summary } = await generateStory("A story about this image", selectedTheme || undefined);
      
      await addDoc(collection(db, 'stories'), {
        title,
        description: summary,
        imageUrl: downloadUrl,
        category: selectedTheme ? `UPLOAD (${selectedTheme.toUpperCase()})` : 'USER UPLOAD',
        authorId: user.uid,
        createdAt: serverTimestamp(),
        style: selectedStyle || 'Default'
      });
      setSelectedTheme(null);
      setSelectedStyle(null);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (user) setIsDraggingOverAddons(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOverAddons(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverAddons(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file || !user || !file.type.startsWith('image/')) return;

    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `uploads/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      
      const { title, summary } = await generateStory("A story about this image", selectedTheme || undefined);
      
      await addDoc(collection(db, 'stories'), {
        title,
        description: summary,
        imageUrl: downloadUrl,
        category: selectedTheme ? `UPLOAD (${selectedTheme.toUpperCase()})` : 'USER UPLOAD',
        authorId: user.uid,
        createdAt: serverTimestamp(),
        style: selectedStyle || 'Default'
      });
      setSelectedTheme(null);
      setSelectedStyle(null);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdateStory = async () => {
    if (!editingStory || !user) return;
    
    try {
      const storyRef = doc(db, 'stories', editingStory.id);
      await updateDoc(storyRef, {
        title: editTitle,
        description: editDescription,
      });
      setEditingStory(null);
    } catch (error) {
      console.error("Update failed:", error);
    }
  };

  const startEditing = (story: Story) => {
    setEditingStory(story);
    setEditTitle(story.title);
    setEditDescription(story.description);
  };

  const handleShare = async (story: Story) => {
    const shareData = {
      title: story.title,
      text: `Check out this magical story: ${story.title}\n\n${story.description}\n\nView Image: ${story.imageUrl}`,
      url: window.location.origin + '?story=' + story.id,
      imageUrl: story.imageUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        const copyText = `${shareData.url}\n\nImage: ${story.imageUrl}`;
        await navigator.clipboard.writeText(copyText);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handlePreview = async () => {
    if (!user) {
      alert("Please log in to preview stories!");
      return;
    }
    if (!prompt.trim()) return;

    setIsPreviewing(true);
    try {
      const data = await generateStory(prompt, selectedTheme || undefined);
      setPreviewData(data);
    } catch (error) {
      console.error("Preview failed:", error);
    } finally {
      setIsPreviewing(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setPrompt(prev => prev ? `${prev} ${transcript}` : transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="min-h-screen bg-[#F8FBFF] font-sans text-[#1A1C1E] pb-24">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-[#0061A4]" />
          </button>
          {user && (
            <div className="flex items-center gap-2">
              <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-blue-100" />
              <span className="text-xs font-bold text-[#0061A4] hidden sm:block">{user.displayName}</span>
            </div>
          )}
        </div>
        
        <h1 className="text-xl font-bold text-[#0061A4] tracking-tight">Editorial Play</h1>
        
        <div className="flex items-center gap-2">
          {user ? (
            <button onClick={handleLogout} className="p-2 hover:bg-red-50 rounded-full transition-colors text-red-500">
              <LogOut className="w-6 h-6" />
            </button>
          ) : (
            <button onClick={handleLogin} className="flex items-center gap-2 bg-[#0061A4] text-white px-4 py-2 rounded-full text-sm font-bold">
              <LogIn className="w-4 h-4" />
              <span>Login</span>
            </button>
          )}
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <Home className="w-6 h-6 text-[#0061A4]" />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 pt-8 space-y-10">
        {/* Hero Section */}
        <section className="text-center space-y-3">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold text-[#0061A4] leading-tight"
          >
            What story shall we build?
          </motion.h2>
          <p className="text-gray-600 text-lg">Type a dream and watch it come to life!</p>
        </section>

        {/* Input Card */}
        <section className="relative">
          <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-blue-100/50 border border-blue-50">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-32 text-xl text-gray-500 bg-transparent border-none focus:ring-0 resize-none placeholder:text-gray-300"
              placeholder="Type your story idea here..."
            />
              <div className="flex gap-4 items-center mt-4">
                <div className="flex gap-2">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept="image/*"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage || !user}
                    className="p-4 bg-blue-50 text-[#0061A4] rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    {uploadingImage ? (
                      <div className="w-5 h-5 border-2 border-[#0061A4]/30 border-t-[#0061A4] rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                  </button>

                  <button 
                    onClick={toggleListening}
                    disabled={!user}
                    className={`p-4 rounded-full transition-all ${
                      isListening 
                        ? 'bg-red-100 text-red-600 animate-pulse' 
                        : 'bg-blue-50 text-[#0061A4] hover:bg-blue-100'
                    } disabled:opacity-50`}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                </div>

                <div className="flex gap-3 flex-1 justify-end">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePreview}
                    disabled={isPreviewing || isGenerating || !user}
                    className="flex items-center gap-2 bg-blue-50 text-[#0061A4] px-6 py-4 rounded-full font-bold shadow-sm disabled:opacity-50"
                  >
                    {isPreviewing ? (
                      <div className="w-5 h-5 border-2 border-[#0061A4]/30 border-t-[#0061A4] rounded-full animate-spin" />
                    ) : (
                      <BookOpen className="w-5 h-5" />
                    )}
                    <span>Preview</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSparkle()}
                    disabled={isGenerating || isPreviewing || !user}
                    className="flex items-center gap-2 bg-[#0061A4] text-white px-8 py-4 rounded-full font-bold shadow-lg shadow-blue-200 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                    <span>Sparkle</span>
                  </motion.button>
                </div>
              </div>
            {!user && <p className="text-center text-xs text-red-400 mt-4 font-bold">Please login to create stories</p>}
          </div>
        </section>

        {/* Story Starters */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Lightbulb className="w-5 h-5 text-[#0061A4]" />
            <h3 className="text-lg font-bold text-[#1A1C1E]">Story Starters</h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 px-2 no-scrollbar">
            {STORY_STARTERS.map((starter) => (
              <button
                key={starter.label}
                onClick={() => setPrompt(starter.prompt)}
                className="flex-shrink-0 w-40 bg-white p-4 rounded-[32px] shadow-sm border border-blue-50 hover:border-[#0061A4] transition-all hover:shadow-md group text-left space-y-3"
              >
                <div className={`w-10 h-10 rounded-2xl ${starter.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <starter.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-[#1A1C1E]">{starter.label}</p>
                  <p className="text-[10px] text-gray-400 line-clamp-2 font-medium">{starter.prompt}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Suggestion Tags */}
        <section className="flex flex-wrap justify-center gap-3">
          {[
            { label: 'Rabbit stories', color: 'bg-[#FFE9C7] text-[#8B5E00]' },
            { label: 'Space cats', color: 'bg-[#D3E4FF] text-[#004A77]' },
            { label: 'Dinosaur tea party', color: 'bg-[#C2FFC7] text-[#006E1C]' },
          ].map((tag) => (
            <button
              key={tag.label}
              onClick={() => setPrompt(tag.label)}
              className={`${tag.color} px-6 py-2 rounded-full font-semibold text-sm transition-transform hover:scale-105 active:scale-95`}
            >
              {tag.label}
            </button>
          ))}
        </section>

        {/* Recent Stories */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#1A1C1E]">
              <History className="w-6 h-6 text-[#0061A4]" />
              <h3 className="text-2xl font-bold">Recent Stories</h3>
            </div>
            <button className="text-[#0061A4] font-bold text-sm hover:underline">View All</button>
          </div>

          <div className="space-y-6">
            {stories.length > 0 && (
              <>
                {/* Featured Story */}
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative aspect-[4/3] rounded-[40px] overflow-hidden group cursor-pointer shadow-lg"
                >
                  <img 
                    src={stories[0].imageUrl} 
                    alt={stories[0].title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  {user?.uid === stories[0].authorId && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(stories[0]);
                      }}
                      className="absolute top-6 right-6 p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  )}

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(stories[0]);
                    }}
                    className={`absolute top-6 ${user?.uid === stories[0].authorId ? 'right-20' : 'right-6'} p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors`}
                  >
                    <Share2 className="w-5 h-5" />
                  </button>

                  <div className="absolute bottom-8 left-8 right-8 space-y-2">
                    <span className="bg-[#008F39] text-white text-[10px] font-black px-3 py-1 rounded-full tracking-wider">
                      {stories[0].category}
                    </span>
                    <h4 className="text-3xl font-bold text-white leading-tight">
                      {stories[0].title}
                    </h4>
                  </div>
                </motion.div>

                {/* Grid/List Stories */}
                <div className="space-y-6">
                  {stories.slice(1, 2).map((story) => (
                    <div key={story.id} className="space-y-3 relative group">
                      <div className="aspect-square rounded-[40px] overflow-hidden shadow-md">
                        <img 
                          src={story.imageUrl} 
                          alt={story.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      {user?.uid === story.authorId && (
                        <button 
                          onClick={() => startEditing(story)}
                          className="absolute top-4 right-4 p-3 bg-white/80 backdrop-blur-md rounded-full text-[#0061A4] opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleShare(story)}
                        className={`absolute top-4 ${user?.uid === story.authorId ? 'right-16' : 'right-4'} p-3 bg-white/80 backdrop-blur-md rounded-full text-[#0061A4] opacity-0 group-hover:opacity-100 transition-opacity shadow-sm`}
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <div className="px-2">
                        <h4 className="text-xl font-bold text-[#1A1C1E]">{story.title}</h4>
                        <p className="text-gray-500 text-sm font-medium">{story.timestamp}</p>
                      </div>
                    </div>
                  ))}

                  {stories.slice(2, 6).map((story) => (
                    <div key={story.id} className="flex items-center gap-4 bg-[#E8F1FF] p-4 rounded-[32px] transition-transform hover:scale-[1.02] cursor-pointer relative group">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm">
                        <img 
                          src={story.imageUrl} 
                          alt={story.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-[#1A1C1E] text-lg leading-tight">{story.title}</h4>
                          {user?.uid === story.authorId && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(story);
                              }}
                              className="p-2 text-[#0061A4] opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShare(story);
                            }}
                            className="p-2 text-[#0061A4] opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-gray-500 text-sm font-medium">{story.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Magic Add-ons */}
        <section 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-[40px] p-8 space-y-6 transition-all duration-300 relative overflow-hidden ${
            isDraggingOverAddons 
              ? 'bg-[#0061A4] scale-[1.02] shadow-2xl ring-4 ring-blue-200' 
              : 'bg-[#D3E4FF]'
          }`}
        >
          <AnimatePresence>
            {isDraggingOverAddons && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#0061A4]/90 flex flex-col items-center justify-center text-white z-10"
              >
                <div className="bg-white/20 p-6 rounded-full mb-4 animate-bounce">
                  <Upload className="w-10 h-10" />
                </div>
                <p className="text-xl font-bold">Drop to create a story!</p>
                <p className="text-sm opacity-70">Your image will inspire a new adventure</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className={`w-6 h-6 ${isDraggingOverAddons ? 'text-white' : 'text-[#0061A4]'}`} />
              <h3 className={`text-xl font-bold ${isDraggingOverAddons ? 'text-white' : 'text-[#004A77]'}`}>Magic Add-ons</h3>
            </div>
            {(selectedTheme || selectedStyle) && (
              <button 
                onClick={() => {
                  setSelectedTheme(null);
                  setSelectedStyle(null);
                }}
                className="text-xs font-bold text-[#0061A4] bg-white px-3 py-1 rounded-full shadow-sm"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <p className={`text-xs font-bold uppercase tracking-wider px-2 ${isDraggingOverAddons ? 'text-white/70' : 'text-[#0061A4]/70'}`}>Themes</p>
              <div className="flex justify-between px-2">
                {[
                  { label: 'Sci-Fi', icon: Rocket, color: 'text-orange-600', theme: 'Sci-Fi' },
                  { label: 'Fairytale', icon: Castle, color: 'text-green-700', theme: 'Fairytale' },
                  { label: 'Animals', icon: PawPrint, color: 'text-red-600', theme: 'Animals' },
                ].map((addon) => (
                  <div key={addon.label} className="flex flex-col items-center gap-3">
                    <button 
                      onClick={() => setSelectedTheme(addon.theme)}
                      className={`w-16 h-16 rounded-[24px] flex items-center justify-center shadow-sm border-2 transition-all group ${
                        selectedTheme === addon.theme 
                          ? 'bg-[#0061A4] border-[#0061A4] scale-110' 
                          : 'bg-white border-dashed border-gray-200 hover:border-[#0061A4]'
                      }`}
                    >
                      <addon.icon className={`w-6 h-6 transition-transform ${
                        selectedTheme === addon.theme ? 'text-white' : addon.color + ' group-hover:scale-110'
                      }`} />
                    </button>
                    <span className={`text-[10px] font-bold transition-colors ${
                      selectedTheme === addon.theme ? 'text-[#0061A4]' : 'text-[#004A77]'
                    }`}>
                      {addon.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className={`text-xs font-bold uppercase tracking-wider px-2 ${isDraggingOverAddons ? 'text-white/70' : 'text-[#0061A4]/70'}`}>Art Styles</p>
              <div className="flex justify-between px-2">
                {[
                  { label: 'Realistic', icon: Camera, color: 'text-blue-600', style: 'Realistic' },
                  { label: 'Cartoon', icon: Smile, color: 'text-yellow-600', style: 'Cartoon' },
                  { label: 'Fantasy', icon: Palette, color: 'text-purple-600', style: 'Fantasy' },
                ].map((style) => (
                  <div key={style.label} className="flex flex-col items-center gap-3">
                    <button 
                      onClick={() => setSelectedStyle(style.style)}
                      className={`w-16 h-16 rounded-[24px] flex items-center justify-center shadow-sm border-2 transition-all group ${
                        selectedStyle === style.style 
                          ? 'bg-[#0061A4] border-[#0061A4] scale-110' 
                          : 'bg-white border-dashed border-gray-200 hover:border-[#0061A4]'
                      }`}
                    >
                      <style.icon className={`w-6 h-6 transition-transform ${
                        selectedStyle === style.style ? 'text-white' : style.color + ' group-hover:scale-110'
                      }`} />
                    </button>
                    <span className={`text-[10px] font-bold transition-colors ${
                      selectedStyle === style.style ? 'text-[#0061A4]' : 'text-[#004A77]'
                    }`}>
                      {style.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {uploadingImage && isDraggingOverAddons && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-20">
              <div className="w-10 h-10 border-4 border-[#0061A4] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 px-6 py-3 z-50">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <NavItem icon={Home} label="Home" />
          <NavItem icon={Plus} label="Creation" active />
          <NavItem icon={ImageIcon} label="Gallery" />
          <NavItem icon={Users} label="Social" />
        </div>
      </nav>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingStory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[40px] p-8 space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-[#0061A4]">Edit Story</h3>
                <button onClick={() => setEditingStory(null)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-400 px-1">Title</label>
                  <input 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 font-bold text-[#1A1C1E] focus:ring-2 focus:ring-[#0061A4]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-400 px-1">Description</label>
                  <textarea 
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl px-4 py-4 h-32 font-medium text-gray-600 focus:ring-2 focus:ring-[#0061A4] resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setEditingStory(null)}
                  className="flex-1 py-4 rounded-full font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateStory}
                  className="flex-1 py-4 rounded-full font-bold text-white bg-[#0061A4] shadow-lg shadow-blue-200 hover:bg-[#004A77] transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[40px] p-8 space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-[#0061A4]">Story Preview</h3>
                <button onClick={() => setPreviewData(null)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Title</p>
                  <p className="text-xl font-bold text-[#1A1C1E]">{previewData.title}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Description</p>
                  <p className="text-gray-600 leading-relaxed">{previewData.summary}</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setPreviewData(null)}
                  className="flex-1 px-6 py-4 rounded-full font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleSparkle(previewData)}
                  disabled={isGenerating}
                  className="flex-1 px-6 py-4 rounded-full font-bold text-white bg-[#0061A4] shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Create Story</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Toast */}
      <AnimatePresence>
        {showShareToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-[#0061A4] text-white px-6 py-3 rounded-full font-bold shadow-xl z-[100] flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Link copied to clipboard!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <button className={`flex flex-col items-center gap-1 transition-all ${active ? 'scale-110' : 'opacity-50 hover:opacity-80'}`}>
      <div className={`p-3 rounded-2xl ${active ? 'bg-[#D3E4FF] text-[#0061A4]' : 'text-gray-400'}`}>
        <Icon className="w-6 h-6" />
      </div>
      <span className={`text-[10px] font-bold ${active ? 'text-[#0061A4]' : 'text-gray-400'}`}>{label}</span>
    </button>
  );
}
