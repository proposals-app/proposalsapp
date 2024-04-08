import { DeduplicateJoinsPlugin, Kysely, MysqlDialect } from "kysely";
import { CamelCasePlugin } from "kysely";
import { createPool } from "mysql2";
import { config as dotenv_config } from "dotenv";
import { DB } from "@proposalsapp/db";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Ollama } from "@langchain/community/llms/ollama";

dotenv_config();

const dialect = new MysqlDialect({
  pool: createPool(process.env.DATABASE_URL!),
});

const db = new Kysely<DB>({
  dialect: dialect,
  plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
});

async function embbed() {
  const llm = new Ollama({
    baseUrl: "http://192.168.7.40:11434",
    model: "mistral",
    maxRetries: 10,
    keepAlive: "5m",
    numCtx: 8192,
  });

  const embeddings = new OllamaEmbeddings({
    baseUrl: "http://192.168.7.40:11434",
    model: "hellord/e5-mistral-7b-instruct:Q4_0",
    maxRetries: 10,
    keepAlive: "5m",
  });

  const vectorStore = await Chroma.fromExistingCollection(embeddings, {
    url: "https://t04c04s.andreiv.xyz",
    collectionName: "ai_playground",
  });

  vectorStore.ensureCollection();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });

  const proposals = await db
    .selectFrom("proposal")
    .selectAll()
    .orderBy("timeEnd", "desc")
    .execute();

  let documents = [];
  let progress = 0;
  for (const proposal of proposals) {
    if (!proposal.body.length) continue;

    console.log(`${progress} out of ${proposals.length}`);
    progress++;

    let content = await llm.invoke(
      `You are an agent tasked to do data cleanup. You make an extensive summary and do not remove any data, or adding any additional data.\n\n Content: \n\n ${proposal.body}`,
    );

    documents.push({ content, title: proposal.name });
    console.log(`${content}`);
    console.log(`\n\n\n\n\n`);
  }

  for (const document of documents) {
    let main_document = await vectorStore.addDocuments([
      {
        pageContent: document.content,
        metadata: {
          title: document.title,
          chunk_size: "big",
        },
      },
    ]);

    const chunks = await splitter.createDocuments([document.content]);

    for (const chunk of chunks) {
      await vectorStore.addDocuments([
        {
          pageContent: chunk.pageContent,
          metadata: {
            title: document.title,
            main_document: main_document[0],
            chunk_size: "small",
          },
        },
      ]);
    }
  }
}

async function test() {
  const llm = new Ollama({
    baseUrl: "http://192.168.7.40:11434",
    model: "mistral",
    maxRetries: 10,
    keepAlive: "5m",
    numCtx: 8192,
  });

  const embeddings = new OllamaEmbeddings({
    baseUrl: "http://192.168.7.40:11434",
    model: "hellord/e5-mistral-7b-instruct:Q4_0",
    maxRetries: 10,
    keepAlive: "5m",
  });

  const vectorStore = await Chroma.fromExistingCollection(embeddings, {
    url: "https://t04c04s.andreiv.xyz",
    collectionName: "ai_playground",
  });

  vectorStore.ensureCollection();

  const hyde_prompt =
    "Given a question, generate a short sentence of text that answers the question.    Question: who is paulo fonseca?";

  const hyde = await llm.invoke(hyde_prompt);

  console.log(`hyde: ${hyde}`);

  const docs = await vectorStore.similaritySearch(
    "This proposal aims to get consent from the Aave community to implement a set of dedicated features for Aave’s governance forum, providing the Aave community with a tool to easily stay on top of Aave’s governance activities, to increase the voting participation rate and the number of new voters, and to prevent proposals from not reaching quorum.",
  );

  console.log(docs);
}

test()
  .then(() => console.log("done!"))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });

module.exports = {};
