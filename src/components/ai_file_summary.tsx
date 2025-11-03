import { Button } from "@/components/ui/button";
import { Loader2, SparklesIcon } from "lucide-react";
import OpenAI from "openai";
import { useState } from "react";

interface Transaction {
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
}

interface AiFileSummaryProps {
    transactions: Transaction[];
    fileName: string;
}

export const AiFileSummary = ({ transactions, fileName }: AiFileSummaryProps) => {
    const [summary, setSummary] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateSummary = async () => {
        setLoading(true);
        setError(null);
        setSummary("");

        try {
            const openai = new OpenAI({
                apiKey: import.meta.env.VITE_OPENAI_API_KEY,
                dangerouslyAllowBrowser: true // Only for development!
            });

            const totalIncome = transactions
                .filter(t => t.type === 'income')
                .reduce((acc, t) => acc + t.amount, 0);

            const totalExpenses = transactions
                .filter(t => t.type === 'expense')
                .reduce((acc, t) => acc + t.amount, 0);

            const netBalance = totalIncome - totalExpenses;

            const expensesByDescription = transactions
                .filter(t => t.type === 'expense')
                .reduce((acc, t) => {
                    const key = t.description.substring(0, 30);
                    if (!acc[key]) {
                        acc[key] = { count: 0, total: 0 };
                    }
                    acc[key].count++;
                    acc[key].total += t.amount;
                    return acc;
                }, {} as Record<string, { count: number; total: number }>);

            const dataForAI = {
                fileName,
                totalTransactions: transactions.length,
                totalIncome,
                totalExpenses,
                netBalance,
                dateRange: {
                    start: transactions[0]?.date,
                    end: transactions[transactions.length - 1]?.date
                },
                topExpenses: Object.entries(expensesByDescription)
                    .sort((a, b) => b[1].total - a[1].total)
                    .slice(0, 10)
                    .map(([desc, data]) => ({ description: desc, total: data.total, count: data.count })),
                sampleTransactions: transactions.slice(0, 20)
            };

            const stream = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are a financial analyst assistant. Analyze bank statement data and provide clear, 
                        actionable insights. Focus on spending patterns, unusual transactions, and financial health. 
                        Use bullet points and keep the summary concise but informative.`
                    },
                    {
                        role: "user",
                        content: `Please analyze this bank statement data and provide a comprehensive summary:

${JSON.stringify(dataForAI, null, 2)}

Provide a summary that includes:
1. Overview of financial activity (date range, transaction count)
2. Income vs Expenses breakdown
3. Top spending categories
4. Notable patterns or insights
5. Any recommendations for financial health

Format the response in a readable way with clear sections.`
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7,
                stream: true
            });

            let fullContent = '';
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullContent += content;
                    setSummary(fullContent);
                }
            }

            if (!fullContent) {
                throw new Error('No summary generated. Please try again.');
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to generate summary';
            setError(errorMessage);
            console.error('OpenAI Error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-6">
            <Button
                onClick={generateSummary}
                disabled={loading || transactions.length === 0}
                className="mb-4"
            >
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Summary...
                    </>
                ) : (
                    <>
                        Generate AI Summary <SparklesIcon className="ml-2 h-4 w-4" />
                    </>
                )}
            </Button>

            {error && (
                <div className="p-4 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-md">
                    ❌ {error}
                </div>
            )}

            {summary && (
                <div className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-xl font-semibold mb-4 flex items-center">
                        <SparklesIcon className="mr-2 h-5 w-5 text-purple-600" />
                        AI Financial Summary
                    </h3>
                    <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                        {summary}
                    </div>
                </div>
            )}
        </div>
    );
};