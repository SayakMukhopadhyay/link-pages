import { Plugin } from "./Plugin.js";
import { Octokit } from "@octokit/core";

export class GithubRepoStarsCountPlugin extends Plugin {
  constructor(data) {
    super(data);
    this.repos = {};
    data[0].forEach((repo) => {
      this.repos[repo] = 0;
    });
    this.octokit = new Octokit();
  }

  async execute() {
    for (const repo in this.repos) {
      this.repos[repo] = await this.loadRepoStars(repo);
    }
    return this.repos;
  }

  async loadRepoStars(ownerRepo) {
    const [owner, repo] = ownerRepo.split("/");
    const repoData = await this.octokit.request("GET /repos/{owner}/{repo}", {
      owner: owner,
      repo: repo,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    return repoData.data.stargazers_count;
  }
}
