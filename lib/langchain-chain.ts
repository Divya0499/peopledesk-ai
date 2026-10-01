import { StringOutputParser } from "@langchain/core/output_parsers";
import { model } from "./langchain-model";
import { prompt } from "./langchain-prompt";

// Pulls the plain text out of the model's AIMessage
const parser = new StringOutputParser();

// LCEL: prompt → model → parser, each step's output is the next step's input.
// JS uses .pipe(); `prompt | model` is Python syntax and in JS is bitwise OR.
export const chain = prompt.pipe(model).pipe(parser);
