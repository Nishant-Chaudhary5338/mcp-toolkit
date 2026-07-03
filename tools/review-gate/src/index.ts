#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { runReview } from './core.js';

class ReviewGateServer extends McpServerBase {
  constructor() {
    super({ name: "review-gate", version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      "run_review",
      "Review a file or directory of generated code and return a grade A–F with the list of issues by severity.",
      {
            "type": "object",
            "properties": {
                  "path": {
                        "type": "string",
                        "description": "Absolute path to a .tsx/.ts file or a directory of generated code to grade."
                  }
            },
            "required": [
                  "path"
            ]
      },
      async (args) => {
        try {
          return this.successWithDashboard('Review Gate', { ...runReview(args) });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new ReviewGateServer().run().catch(console.error);
