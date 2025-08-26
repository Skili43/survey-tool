import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, Plus, Wand2, BarChart2, Eye, Settings2, Trash2, FileText, Copy, ChevronUp, ChevronDown } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";

// -----------------------------
// Types
// -----------------------------

const LIKERT_OPTIONS = ["1", "2", "3", "4", "5"]; // 1: Pas du tout d'accord -> 5: Tout à fait d'accord

/** @typedef {{ id:string, text:string, type:'likert'|'open'|'mcq', options?: string[], theme?: string }} Question */
/** @typedef {{ [questionId:string]: string }} ResponseRow */

// -----------------------------
// Helpers
// -----------------------------

function uid(prefix = "q") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function download(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(questions, responses) {
  const headers = ["respondent_id", ...questions.map((q) => q.text.replaceAll("\n", " "))];
  const lines = [headers.join(",")];
  responses.forEach((row, idx) => {
    const values = questions.map((q) => (row[q.id] ?? "").toString().replaceAll(",", ";"));
    lines.push([`R${idx + 1}`, ...values].join(","));
  });
  return lines.join("\n");
}

function avg(numbers) {
  const arr = numbers.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function simpleSentiment(text) {
  // Ultra simple FR lexicon-based (placeholder). Returns -1..1
  if (!text) return 0;
  const pos = ["merci", "bien", "satisfait", "excellent", "positif", "fiers", "écouté", "claire", "utile", "motivé", "reconnu"];
  const neg = ["stress", "charge", "mauvais", "négatif", "fatigue", "burnout", "épuisé", "confus", "injuste", "toxique", "trop"];
  const t = text.toLowerCase();
  let score = 0;
  pos.forEach((w) => (t.includes(w) ? (score += 1) : null));
  neg.forEach((w) => (t.includes(w) ? (score -= 1) : null));
  return Math.max(-3, Math.min(3, score)) / 3;
}

// -----------------------------
// AI Generator (placeholder logic)
// -----------------------------

function generateQuestionsWithAI({ objectif, themes, ton, longueur }) {
  // In real app, replace by an API call. Here: curated bank + rules.
  /** @type {Question[]} */
  const pool = [];

  const lib = {
    Engagement: {
      likert: [
        "Je recommanderais mon entreprise comme un bon endroit où travailler.",
        "Je me sens impliqué(e) et motivé(e) par mon travail au quotidien.",
        "Je comprends comment mon travail contribue aux objectifs de l'entreprise.",
      ],
      open: [
        "Qu'est-ce qui renforcerait le plus votre engagement dans les 3 prochains mois ?",
      ],
    },
    Communication: {
      likert: [
        "L'information circule de manière claire et en temps utile dans mon équipe.",
        "Je reçois du feedback régulier et utile de la part de mon manager.",
      ],
      open: ["Quel message clé manque aujourd'hui pour mieux avancer ?"],
    },
    Leadership: {
      likert: [
        "Mon manager favorise la confiance et l'autonomie.",
        "Les décisions de leadership sont transparentes et cohérentes.",
      ],
      open: ["Quelle attitude de leadership serait la plus utile à développer ?"],
    },
    BienÊtre: {
      likert: [
        "Je peux préserver un équilibre sain entre vie professionnelle et personnelle.",
        "Ma charge de travail est soutenable sur la durée.",
      ],
      open: ["Quelles actions simples pourraient améliorer votre bien-être ?"],
    },
    Burnout: {
      likert: [
        "Je me sens fréquemment épuisé(e) émotionnellement par mon travail.",
        "Je dispose de ressources suffisantes pour faire face au stress professionnel.",
      ],
      open: ["Quels signaux de surcharge observez-vous dans votre quotidien ?"],
    },
    Reconnaissance: {
      likert: [
        "Je me sens reconnu(e) pour mes contributions.",
        "La reconnaissance est équitable et cohérente dans l'équipe.",
      ],
      open: ["Quel type de reconnaissance a le plus d'impact pour vous ?"],
    },
  };

  const mapKey = {
    Engagement: "Engagement",
    Communication: "Communication",
    Leadership: "Leadership",
    BienÊtre: "BienÊtre",
    Burnout: "Burnout",
    Reconnaissance: "Reconnaissance",
  };

  themes.forEach((th) => {
    const key = mapKey[th];
    if (!key) return;
    lib[key].likert.forEach((t) => pool.push({ id: uid(), text: t, type: "likert", options: LIKERT_OPTIONS, theme: th }));
    lib[key].open.forEach((t) => pool.push({ id: uid(), text: t, type: "open", theme: th }));
  });

  let desired = 10;
  if (longueur === "courte") desired = 8;
  if (longueur === "longue") desired = 18;

  let picked = pool.slice(0, desired);

  // Tone: optionally adjust phrasing
  if (ton === "bienveillance") {
    picked = picked.map((q) => ({
      ...q,
      text: q.text.replace("Je ", "Dans l'ensemble, je ") + " (réponse honnête et sans conséquence)",
    }));
  }
  if (objectif?.toLowerCase().includes("onboarding")) {
    picked.push({ id: uid(), type: "open", text: "Qu'auriez-vous aimé recevoir/clarifier lors de votre arrivée ?", theme: "Onboarding" });
  }

  // Ensure at least one open question at end
  if (!picked.some((q) => q.type === "open")) {
    picked.push({ id: uid(), type: "open", text: "Quel est l'unique changement le plus utile ?", theme: "Général" });
  }
  return picked.slice(0, desired);
}

// -----------------------------
// Main Component
// -----------------------------

export default function SurveyAIPrototype() {
  const [orgName, setOrgName] = useState("Entreprise Demo");
  const [objectif, setObjectif] = useState("Mesurer l'engagement global et identifier 3 priorités d'action.");
  const [taille, setTaille] = useState("50-199");
  const [anonymous, setAnonymous] = useState(true);
  const [themes, setThemes] = useState(["Engagement", "Communication", "Reconnaissance", "BienÊtre"]);
  const [ton, setTon] = useState("neutre");
  const [longueur, setLongueur] = useState("standard");

  /** @type {[Question[],Function]} */
  const [questions, setQuestions] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);

  const [responses, setResponses] = useState([]); // Array<ResponseRow>
  const [currentResp, setCurrentResp] = useState({});

  const themeList = ["Engagement", "Communication", "Leadership", "Reconnaissance", "BienÊtre", "Burnout"];

  const likertStats = useMemo(() => {
    const rows = questions
      .filter((q) => q.type === "likert")
      .map((q) => {
        const vals = responses
          .map((r) => Number(r[q.id]))
          .filter((v) => !Number.isNaN(v));
        return { name: q.text.slice(0, 32) + (q.text.length > 32 ? "…" : ""), avg: avg(vals) };
      });
    return rows;
  }, [questions, responses]);

  const sentimentScore = useMemo(() => {
    const texts = responses
      .flatMap((r) => questions.filter((q) => q.type === "open").map((q) => r[q.id]))
      .filter(Boolean);
    if (!texts.length) return 0;
    const scores = texts.map((t) => simpleSentiment(t));
    return avg(scores);
  }, [responses, questions]);

  function toggleTheme(th) {
    setThemes((prev) => (prev.includes(th) ? prev.filter((x) => x !== th) : [...prev, th]));
  }

  function handleGenerate() {
    const qs = generateQuestionsWithAI({ objectif, themes, ton, longueur });
    setQuestions(qs);
  }

  function updateQuestion(idx, patch) {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function moveQuestion(idx, dir) {
    setQuestions((prev) => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  }

  function removeQuestion(idx) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function addQuestion(type = "likert") {
    const q = { id: uid(), text: "Nouvelle question…", type, options: type === "likert" ? LIKERT_OPTIONS : [], theme: "Custom" };
    setQuestions((prev) => [...prev, q]);
  }

  function recordCurrentResponse() {
    setResponses((prev) => [...prev, currentResp]);
    setCurrentResp({});
  }

  function copyLink() {
    // Fake share link (app would create a unique URL). Here we copy a JSON payload.
    const payload = { orgName, objectif, anonymous, questions };
    navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-semibold tracking-tight">🧠 Prototype IA — Générateur d’enquêtes d’engagement</h1>
        <p className="text-sm text-muted-foreground mt-1">Crée, partage et analyse une enquête sur-mesure en quelques minutes. (Prototype local — IA simulée)</p>
      </motion.div>

      <Tabs defaultValue="design" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="design"><Settings2 className="w-4 h-4 mr-2"/>Design</TabsTrigger>
          <TabsTrigger value="preview"><Eye className="w-4 h-4 mr-2"/>Aperçu</TabsTrigger>
          <TabsTrigger value="collect"><FileText className="w-4 h-4 mr-2"/>Collecte</TabsTrigger>
          <TabsTrigger value="analyze"><BarChart2 className="w-4 h-4 mr-2"/>Analyse</TabsTrigger>
        </TabsList>

        {/* DESIGN */}
        <TabsContent value="design">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>🎯 Contexte & objectifs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Organisation</label>
                    <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Taille</label>
                    <Select value={taille} onValueChange={setTaille}>
                      <SelectTrigger><SelectValue placeholder="Taille" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-49">1–49</SelectItem>
                        <SelectItem value="50-199">50–199</SelectItem>
                        <SelectItem value="200-999">200–999</SelectItem>
                        <SelectItem value=">=1000">≥ 1000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Objectif</label>
                  <Textarea value={objectif} onChange={(e) => setObjectif(e.target.value)} rows={3} />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium">Ton</label>
                    <Select value={ton} onValueChange={setTon}>
                      <SelectTrigger><SelectValue placeholder="Ton"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="neutre">Neutre</SelectItem>
                        <SelectItem value="bienveillance">Bienveillance</SelectItem>
                        <SelectItem value="direct">Direct</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Longueur</label>
                    <Select value={longueur} onValueChange={setLongueur}>
                      <SelectTrigger><SelectValue placeholder="Taille"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="courte">Courte (~8)</SelectItem>
                        <SelectItem value="standard">Standard (~10)</SelectItem>
                        <SelectItem value="longue">Longue (~18)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <Switch checked={anonymous} onCheckedChange={setAnonymous} id="anon" />
                    <label htmlFor="anon" className="text-sm">Réponses anonymes</label>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Thèmes</div>
                  <div className="flex flex-wrap gap-2">
                    {themeList.map((th) => (
                      <Badge key={th} onClick={() => toggleTheme(th)} className={`cursor-pointer select-none ${themes.includes(th) ? "" : "opacity-40"}`}>
                        {th}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleGenerate}><Wand2 className="w-4 h-4 mr-2"/>Générer avec IA</Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" onClick={() => addQuestion("likert")}><Plus className="w-4 h-4 mr-2"/>Question Likert</Button>
                      </TooltipTrigger>
                      <TooltipContent>Ajouter manuellement une question (1–5).</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button variant="secondary" onClick={() => addQuestion("open")}><Plus className="w-4 h-4 mr-2"/>Question ouverte</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>📦 Export</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Partage : copie un payload JSON partageable ou exporte un modèle CSV pour les réponses.</p>
                <div className="flex gap-2">
                  <Button onClick={() => copyLink()}><Copy className="w-4 h-4 mr-2"/>Copier le lien (JSON)</Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => download(`modele_enquete_${orgName}.csv`, toCSV(questions, []))}><Download className="w-4 h-4 mr-2"/>Exporter modèle CSV</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>🧩 Banque de questions (éditable)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {questions.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune question pour l'instant. Utilise <em>Générer avec IA</em> ou ajoute des questions manuellement.</p>
              )}

              <div className="space-y-2">
                {questions.map((q, idx) => (
                  <div key={q.id} className="flex items-start gap-3 p-3 rounded-2xl border">
                    <div className="flex flex-col pt-1">
                      <Button variant="ghost" size="icon" onClick={() => moveQuestion(idx, -1)} className="h-7 w-7"><ChevronUp className="w-4 h-4"/></Button>
                      <Button variant="ghost" size="icon" onClick={() => moveQuestion(idx, 1)} className="h-7 w-7"><ChevronDown className="w-4 h-4"/></Button>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2 flex-wrap items-center">
                        <Badge variant="secondary">{q.theme || "Général"}</Badge>
                        <Badge>{q.type === "likert" ? "1–5 Likert" : q.type === "open" ? "Ouverte" : "MCQ"}</Badge>
                      </div>
                      {editingIndex === idx ? (
                        <Textarea value={q.text} onChange={(e) => updateQuestion(idx, { text: e.target.value })} rows={2} />
                      ) : (
                        <div className="text-sm">{q.text}</div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingIndex(editingIndex === idx ? null : idx)}>
                          {editingIndex === idx ? "Terminer" : "Éditer"}
                        </Button>
                        {q.type === "likert" && (
                          <Button size="sm" variant="secondary" onClick={() => updateQuestion(idx, { type: "open", options: [] })}>Transformer en ouverte</Button>
                        )}
                        {q.type === "open" && (
                          <Button size="sm" variant="secondary" onClick={() => updateQuestion(idx, { type: "likert", options: LIKERT_OPTIONS })}>Transformer en Likert</Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => removeQuestion(idx)}><Trash2 className="w-4 h-4 mr-1"/>Supprimer</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PREVIEW */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>👀 Aperçu enquête — {orgName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-sm text-muted-foreground">Objectif : {objectif}</div>
              {questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune question. Va dans l'onglet <b>Design</b> pour générer ton questionnaire.</p>
              ) : (
                <div className="space-y-4">
                  {questions.map((q) => (
                    <div key={q.id} className="p-3 rounded-2xl border">
                      <div className="text-sm font-medium mb-2">{q.text}</div>
                      {q.type === "likert" ? (
                        <div className="flex gap-2">
                          {LIKERT_OPTIONS.map((o) => (
                            <Badge key={o} variant="outline">{o}</Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Réponse ouverte…</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* COLLECT */}
        <TabsContent value="collect">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>📝 Saisir une réponse (simulation)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.length === 0 && (
                  <p className="text-sm text-muted-foreground">Crée d'abord des questions dans l'onglet Design.</p>
                )}
                {questions.map((q) => (
                  <div key={q.id} className="p-3 rounded-2xl border">
                    <div className="text-sm font-medium mb-2">{q.text}</div>
                    {q.type === "likert" ? (
                      <div className="flex gap-2 flex-wrap">
                        {LIKERT_OPTIONS.map((o) => (
                          <Button key={o} size="sm" variant={(currentResp[q.id] || "") === o ? "default" : "outline"} onClick={() => setCurrentResp({ ...currentResp, [q.id]: o })}>{o}</Button>
                        ))}
                      </div>
                    ) : (
                      <Textarea rows={3} value={currentResp[q.id] || ""} onChange={(e) => setCurrentResp({ ...currentResp, [q.id]: e.target.value })} />
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button onClick={recordCurrentResponse}><Plus className="w-4 h-4 mr-2"/>Ajouter la réponse</Button>
                  <Button variant="secondary" onClick={() => setCurrentResp({})}>Réinitialiser</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>📤 Export des réponses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-4xl font-semibold">{responses.length}</div>
                <div className="text-sm text-muted-foreground">réponse(s) enregistrée(s)</div>
                <Button onClick={() => download(`reponses_${orgName}.csv`, toCSV(questions, responses))}><Download className="w-4 h-4 mr-2"/>Télécharger CSV</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ANALYZE */}
        <TabsContent value="analyze">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>📈 Synthèse</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-3 rounded-2xl border">
                  <div className="text-sm font-medium mb-2">Moyennes par question (Likert)</div>
                  {likertStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Pas de données encore. Ajoute au moins une réponse.</p>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={likertStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-10} height={50} interval={0} tick={{ fontSize: 12 }} />
                          <YAxis domain={[0, 5]} />
                          <RTooltip />
                          <Bar dataKey="avg" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-2xl border">
                  <div className="text-sm font-medium mb-2">Sentiment global (réponses ouvertes)</div>
                  <div className="flex items-center gap-3">
                    <div className={`text-3xl font-semibold ${sentimentScore > 0.15 ? "text-green-600" : sentimentScore < -0.15 ? "text-red-600" : "text-yellow-600"}`}>
                      {(sentimentScore * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-muted-foreground">-100% (très négatif) → +100% (très positif)</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl border">
                  <div className="text-sm font-medium mb-2">Recommandations (automatiques)</div>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    <li>Partager 3 priorités claires issues de l'enquête et nommer un sponsor par priorité.</li>
                    <li>Planifier un <em>check-in</em> d'équipe de 30 minutes pour passer en revue les résultats et co-créer 1 action par thème.</li>
                    <li>Mettre en place un rituel de reconnaissance hebdomadaire (simple, pair-à-pair).</li>
                    <li>Balancer la charge : limiter le WIP, clarifier les priorités, points rapides de désescalade.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ℹ️ Paramètres</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="font-medium">Organisation :</span> {orgName}</div>
                <div><span className="font-medium">Taille :</span> {taille}</div>
                <div><span className="font-medium">Anonymat :</span> {anonymous ? "Oui" : "Non"}</div>
                <div><span className="font-medium">Themes :</span> {themes.join(", ")}</div>
                <div><span className="font-medium">Ton :</span> {ton}</div>
                <div><span className="font-medium">Longueur :</span> {longueur}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <footer className="text-xs text-muted-foreground text-center pt-4">
        Prototype local — aucune donnée envoyée à un serveur. Remplace la génération par IA par un appel API pour une version connectée.
      </footer>
    </div>
  );
}
