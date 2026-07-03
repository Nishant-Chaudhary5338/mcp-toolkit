#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { runWorkflow } from './core.js';

class WorkflowRunnerServer extends McpServerBase {
  constructor() {
    super({ name: "workflow-runner", version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      "run_workflow",
      'Run a named routine (currently "schema_to_feature") over a JSON sample or FieldSchema. ' +
        'Returns { files: [{ filename, code }], journal: [{ step, ok, note }], grade (A–F), passed, resource, dataLayer, router, fileCount }. ' +
        'The files compose a full CRUD feature: Zod schema, api client (rtk|tanstack), table, detail, create+edit forms, and routes (rr7|next). ' +
        'Limitation: generated code assumes its peer deps (zod, @reduxjs/toolkit or @tanstack/react-query, react-hook-form, @tanstack/react-table, react-router-dom) are installed in the target project.',
      {
            "type": "object",
            "properties": {
                  "input": {
                        "type": "string",
                        "description": "A JSON API sample, or a FieldSchema (as a JSON string), to build the feature from."
                  },
                  "routine": {
                        "type": "string",
                        "enum": [
                              "schema_to_feature"
                        ],
                        "description": "Routine to run. Defaults to \"schema_to_feature\"."
                  },
                  "dataLayer": {
                        "type": "string",
                        "enum": [
                              "rtk",
                              "tanstack"
                        ],
                        "description": "Data layer for generated hooks. Defaults to \"rtk\"."
                  },
                  "router": {
                        "type": "string",
                        "enum": [
                              "rr7",
                              "next"
                        ],
                        "description": "Router target for crud-composer. Defaults to \"rr7\"."
                  },
                  "resource": {
                        "type": "string",
                        "description": "Resource name override passed to infer-fields."
                  },
                  "baseEndpoint": {
                        "type": "string",
                        "description": "REST base endpoint passed to infer-fields."
                  }
            },
            "required": [
                  "input"
            ]
      },
      async (args) => {
        try {
          return this.successWithDashboard('Workflow Runner', { ...runWorkflow(args) });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new WorkflowRunnerServer().run().catch(console.error);
