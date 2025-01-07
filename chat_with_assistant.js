// Import necessary modules
import fs from "fs";
import dotenv from "dotenv";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CSVLoader } from "langchain/document_loaders/fs/csv";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { OpenAI } from "@langchain/openai";
import { RetrievalQAChain } from "langchain/chains";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";

// Load environment variables early
dotenv.config();

// Ensure the ./data directory exists
const path = "./data";
if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
    console.log("Created missing ./data directory");
}

// Initialize the document loader with supported file formats
const loader = new DirectoryLoader("./data", {
    ".txt": (filePath) => new TextLoader(filePath),
    ".csv": (filePath) => new CSVLoader(filePath),
    ".pdf": (filePath) => new PDFLoader(filePath),
    ".docx": (filePath) => new DocxLoader(filePath),
});

// Load documents asynchronously
console.log("Loading docs...");
let docs;
try {
    docs = await loader.load();
    console.log("Docs loaded.");
} catch (error) {
    console.error("Error loading documents:", error);
}

const VECTOR_STORE_PATH = "Data.index";

// Normalize the content of documents
function normalizeDocuments(docs) {
    return docs.map((doc) => {
        if (typeof doc.pageContent === "string") {
            return doc.pageContent;
        } else if (Array.isArray(doc.pageContent)) {
            return doc.pageContent.join("\n");
        }
        return ""; // Fallback for unexpected cases
    });
}

// Define the system prompt for the AI model
const openPrompt = ChatPromptTemplate.fromMessages([
    [
        "system",
        `You are an AI trained to simulate the responses of Rahees Ahmed, a backend developer skilled in Node.js and Python with a deep focus on AI automation, API integration, REST API development, ChatGPT integration, custom trained chatbots, and web scraping. You are proficient in deploying AI capabilities within software applications to enhance user interactions and automate processes. Your responses should reflect expertise in these areas, offering technical advice, innovative solutions, and professional insight into developing robust AI-driven applications. You value precision, efficiency, and the practical application of emerging technologies to solve real-world problems. Your communication style is clear, concise, and focused, aimed at delivering valuable information and guidance to fellow developers and tech enthusiasts. You will receive messages from WhatsApp in Roman Urdu. If you don't know the answer, don't make up an answer. Always respond in short answers and answer the user's questions based on the below context:\n\n{context}`,
    ],
    ["human", "{question}"],
]);

const messageHistory = new ChatMessageHistory();

// Main function to run the AI model
export const runModel = async (question) => {
    // Initialize OpenAI language model
    const model = new OpenAI({
        temperature: 0.7,
        maxTokens: 100,
        modelName: "gpt-4o-mini",
    });

    let vectorStore;

    // Check for existing vector store
    console.log("Checking for existing vector store...");
    if (fs.existsSync(VECTOR_STORE_PATH)) {
        try {
            console.log("Loading existing vector store...");
            vectorStore = await HNSWLib.load(VECTOR_STORE_PATH, new OpenAIEmbeddings());
            console.log("Vector store loaded.");
        } catch (error) {
            console.error("Error loading vector store:", error);
        }
    } else {
        try {
            console.log("Creating new vector store...");
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
            });
            const normalizedDocs = normalizeDocuments(docs);
            const splitDocs = await textSplitter.createDocuments(normalizedDocs);

            // Generate vector store
            vectorStore = await HNSWLib.fromDocuments(splitDocs, new OpenAIEmbeddings());
            await vectorStore.save(VECTOR_STORE_PATH);
            console.log("Vector store created.");
        } catch (error) {
            console.error("Error creating vector store:", error);
        }
    }

    // Add user query to message history
    await messageHistory.addMessage({
        content: question,
        additional_kwargs: {},
    });

    // Create retrieval chain
    console.log("Creating retrieval chain...");
    const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
        prompt: openPrompt,
        messageHistory: messageHistory,
    });

    // Query retrieval chain with user question
    console.log("Querying chain...");
    try {
        const res = await chain.invoke({ query: question });
        return res.text;
    } catch (error) {
        console.error("Error querying chain:", error);
        return "Sorry, I couldn't process your request.";
    }
};

