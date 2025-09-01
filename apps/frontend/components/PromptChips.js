const presets = [
    "Summarize the uploaded policy",
    "What is the vacation rule?",
    "List onboarding steps",
    "Any security training deadlines?"
  ];
  
  export default function PromptChips({ onPick }) {
    return (
      <div className="flex flex-wrap gap-2 p-3 border-b border-stroke glass">
        {presets.map((p, i) => (
          <button key={i}
            onClick={() => onPick(p)}
            className="px-3 py-1.5 text-sm rounded-full bg-white/5 border border-white/10 hover:bg-white/10"
            title="Click to prefill"
          >{p}</button>
        ))}
      </div>
    );
  }
  