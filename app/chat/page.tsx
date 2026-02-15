export default function OrigoChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Wir setzen projectId hier als einfache Konstante. 
  // Das verhindert JEDEN Linter-Fehler, da keine ungenutzte 'set'-Funktion existiert.
  const projectId = null; 
  
  const scrollRef = useRef<HTMLDivElement>(null);
