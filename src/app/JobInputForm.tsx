import { profile } from "console";
import React, { useState, useEffect } from "react";

interface Profile {
  id: string;
  name: string;
}

interface JobInputFormProps {
  token: string;
}

// IndexedDB helpers for Chromium directory handle (per profile)
function getDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open("resume-tailor", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("settings"))
        db.createObjectStore("settings");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function saveDirHandle(profileId: string, handle: FileSystemDirectoryHandle) {
  return getDb().then((db) => {
    const tx = db.transaction("settings", "readwrite");
    tx.objectStore("settings").put(handle, `directory-${profileId}`);
    return;
  });
}
function loadDirHandle(profileId: string): Promise<FileSystemDirectoryHandle | null> {
  return getDb().then((db) => {
    return new Promise((res) => {
      const tx = db.transaction("settings", "readonly");
      const req = tx.objectStore("settings").get(`directory-${profileId}`);
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
  });
}
function clearDirHandle(profileId: string) {
  return getDb().then((db) => {
    const tx = db.transaction("settings", "readwrite");
    tx.objectStore("settings").delete(`directory-${profileId}`);
    return;
  });
}

const JobInputForm: React.FC<JobInputFormProps> = ({ token }) => {
  // Profile selection and folder map state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [profileName, setProfileName] = useState<string>("");
  const [dirHandles, setDirHandles] = useState<{ [id: string]: FileSystemDirectoryHandle | null }>({});
  // Job data
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  // Feedback and state
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fsSupported, setFSSupported] = useState(false);

  // Fetch profiles
  useEffect(() => {
    if (!token) return;
    const fetchProfiles = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
        const res = await fetch(`${backendUrl}/profiles`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch profiles.");
        const data = await res.json();
        setProfiles(data.profiles);
      } catch (e) {
        setError("Could not load profiles. " + (e as Error).message);
      }
    };
    fetchProfiles();
  }, [token]);

  // Set File System API support
  useEffect(() => {
    if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
      setFSSupported(true);
    }
  }, []);

  // Load all saved dir handles for all profiles
  useEffect(() => {
    if (!fsSupported) return;
    const fetchHandles = async () => {
      const handles: { [id: string]: FileSystemDirectoryHandle | null } = {};
      await Promise.all(
        profiles.map(async (p) => {
          handles[p.id] = await loadDirHandle(p.id);
        })
      );
      setDirHandles(handles);
    };
    if (profiles.length > 0) fetchHandles();
  }, [fsSupported, profiles]);

  // Update selectedProfileId => show its name
  useEffect(() => {
    const p = profiles.find((p) => p.id === selectedProfileId);
    if (p) setProfileName(p.name);
    else setProfileName("");
  }, [selectedProfileId, profiles]);

  // Set/change/clear the folder for current profile
  const handleSetFolder = async (profileId: string) => {
    setError(null);
    setResponse(null);
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      // @ts-ignore
      const perm = (await handle.requestPermission)
        ? await handle.requestPermission({ mode: "readwrite" })
        : "granted";
      if (perm === "granted") {
        await saveDirHandle(profileId, handle);
        setDirHandles((prev) => ({ ...prev, [profileId]: handle }));
        setResponse("Save folder set for this profile.");
      } else {
        setError("No permission. Try again.");
      }
    } catch (e) {
      setError("Folder selection cancelled.");
    }
  };

  const handleClearFolder = async (profileId: string) => {
    await clearDirHandle(profileId);
    setDirHandles((prev) => ({ ...prev, [profileId]: null }));
    setResponse("Save folder preference cleared for this profile.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName) {
      setError("You must select a profile.");
      return;
    }
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const formData = new FormData();
      formData.append("profile_name", profileName);
      formData.append("job_description", jobDescription);
      formData.append("company", companyName);
      formData.append("role", role);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
      const res = await fetch(
        `${backendUrl}/generate_dynamic_resume_pdf`,
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!res.ok) {
        let errorMsg = "Failed to generate PDF.";
        try {
          const errorJson = await res.json();
          errorMsg = errorJson.error || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }
      const blob = await res.blob();
      // Build filename: <ProfileName>_<Company>_<Role>.pdf
      const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, "_");
      let filename = `${sanitize(profileName)}_${sanitize(companyName)}_${sanitize(role)}.pdf`;

      let saved = false;
      // Per-profile auto-save folder preference
      const currentDirHandle = dirHandles[selectedProfileId];
      if (fsSupported && currentDirHandle) {
        try {
          let perm = "granted";
          if ((currentDirHandle as any).requestPermission)
            perm = await (currentDirHandle as any).requestPermission({
              mode: "readwrite",
            });
          if (perm === "granted") {
            const fileHandle = await currentDirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            setResponse(`PDF saved automatically to folder for this profile: ${filename}`);
            saved = true;
          } else {
            setError("No write permission for this profile's folder.");
          }
        } catch (e) {
          setError("Failed to save to folder. Falling back to Save As/Download.");
        }
      }
      if (!saved) {
        // fallback
        const saveWithFilePicker = async () => {
          try {
            if ("showSaveFilePicker" in window) {
              // @ts-ignore
              const opts = {
                suggestedName: filename,
                types: [
                  {
                    description: "PDF file",
                    accept: { "application/pdf": [".pdf"] },
                  },
                ],
              };
              // @ts-ignore
              const fileHandle = await window.showSaveFilePicker(opts);
              const writable = await fileHandle.createWritable();
              await writable.write(blob);
              await writable.close();
              setResponse(`PDF saved: ${fileHandle.name}`);
              return true;
            }
          } catch {
            // fallback
          }
          return false;
        };
        const pickerWorked = await saveWithFilePicker();
        if (!pickerWorked) {
          // Fallback: classic download
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }, 100);
          setResponse(`PDF downloaded: ${filename}`);
        }
      }
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-w-xl w-full mx-auto bg-white shadow-xl border border-blue-100 p-8 rounded-lg mt-6"
    >
      <h2 className="text-2xl font-semibold text-blue-800 mb-2 text-center">
        Enter Job Details
      </h2>

      {/* Profile selection dropdown */}
      <div>
        <label
          htmlFor="profile"
          className="block text-gray-700 font-semibold mb-1"
        >
          Select Profile (Resume)
        </label>
        <select
          id="profile"
          required
          value={selectedProfileId}
          onChange={(e) => setSelectedProfileId(e.target.value)}
          className="w-full border border-blue-300 focus:border-blue-600 outline-none px-3 py-2 rounded transition text-gray-900"
        >
          <option value="">-- Choose Profile --</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </div>

      {/* Per-profile folder preference UI */}
      {fsSupported && selectedProfileId && (
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => handleSetFolder(selectedProfileId)}
            className="px-3 py-1 rounded bg-blue-100 hover:bg-blue-200 border border-blue-200 text-blue-800 font-semibold shadow transition"
          >
            {dirHandles[selectedProfileId]
              ? "Change Save Folder for this Profile"
              : "Set Save Folder for this Profile"}
          </button>
          {dirHandles[selectedProfileId] && (
            <button
              type="button"
              onClick={() => handleClearFolder(selectedProfileId)}
              className="px-3 py-1 rounded bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 font-semibold shadow transition"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-gray-500">
            {dirHandles[selectedProfileId]
              ? "Auto-save will use this folder for the selected profile."
              : "Supported: Chrome & Edge."}
          </span>
        </div>
      )}
      <div>
        <label
          htmlFor="companyName"
          className="block text-gray-700 font-semibold mb-1"
        >
          Company Name
        </label>
        <input
          id="companyName"
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
          placeholder="e.g., Google, Amazon..."
          className="w-full border border-blue-300 focus:border-blue-600 outline-none px-3 py-2 rounded mb-1 transition text-gray-900 placeholder:text-gray-500"
        />
      </div>
      <div>
        <label
          htmlFor="role"
          className="block text-gray-700 font-semibold mb-1"
        >
          Role / Position
        </label>
        <input
          id="role"
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
          placeholder="e.g., Software Engineer, Product Manager..."
          className="w-full border border-blue-300 focus:border-blue-600 outline-none px-3 py-2 rounded mb-1 transition text-gray-900 placeholder:text-gray-500"
        />
      </div>
      <div>
        <label
          htmlFor="jobDescription"
          className="block text-gray-700 font-semibold mb-1"
        >
          Job Description
        </label>
        <textarea
          id="jobDescription"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          required
          rows={6}
          placeholder="Paste the job description here..."
          className="w-full border border-blue-300 focus:border-blue-600 outline-none px-3 py-2 rounded resize-none text-gray-900 placeholder:text-gray-500"
        />
      </div>
      <div className="relative w-full min-h-[46px] flex items-center justify-center">
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-700 text-white px-4 py-2 rounded font-semibold shadow hover:bg-blue-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Generating PDF..." : "Submit"}
        </button>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/60 rounded">
            <span className="block h-8 w-8 border-4 border-blue-700 border-t-transparent border-b-transparent rounded-full animate-spin mr-2"></span>
            <span className="text-blue-900 font-semibold">In progress ...</span>
          </div>
        )}
      </div>
      {response && (
        <div className="mt-4 bg-green-50 border-l-4 border-green-400 p-3 rounded text-green-900 text-center shadow animate-fade-in">
          <span className="font-bold">Response:</span> {response}
        </div>
      )}
      {error && (
        <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-3 rounded text-red-900 text-center shadow animate-fade-in">
          <span className="font-bold">Error:</span> {error}
        </div>
      )}
    </form>
  );
};

export default JobInputForm;
