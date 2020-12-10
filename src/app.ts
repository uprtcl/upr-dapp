import { LitElement, html, query, css, internalProperty } from "lit-element";
import { ethers } from "ethers";
import { sharedStyles } from "./styles";

export class App extends LitElement {
  @internalProperty()
  loading: boolean = true;

  @internalProperty()
  errorLoading: boolean = false;

  @internalProperty()
  error!: any;

  @query("#outlet")
  outlet: HTMLElement;

  async firstUpdated() {
    const provider = new ethers.providers.Web3Provider(
      (window as any).ethereum
    );
    this.loading = false;
  }

  render() {
    if (this.loading) {
      return html`loading...`;
    }
    return html`<div class="container">hello</div>`;
  }

  static get styles() {
    return [
      sharedStyles,
      css`
        :host {
          height: 100vh;
          flex-direction: column;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .container {
          position: relative;
          top: 0;
          flex: 1 1 auto;
          width: 100%;
          background-color: #fbfbfb;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
      `,
    ];
  }
}
