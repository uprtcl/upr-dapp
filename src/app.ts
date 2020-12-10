import { LitElement, html, query, css, internalProperty } from "lit-element";
import { ethers } from "ethers";
import { sharedStyles } from "./styles";

import { abi as abiUpr } from "./StaircaseBondingCurve.min.json";
import { abi as abiDai } from "./DAI.json";

import "@material/mwc-button";
import "@material/mwc-circular-progress";

const CONTRACT_ADDRESS = "0xEEB618686fb36F6B07b44b763B1A5C4267f0c5d7";
const DAI_ADDRESS = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";

export class App extends LitElement {
  @internalProperty()
  loading: boolean = true;

  @internalProperty()
  supply: ethers.BigNumber;

  @internalProperty()
  available1: ethers.BigNumber;

  @internalProperty()
  available2: ethers.BigNumber;

  @internalProperty()
  price: ethers.BigNumber;

  @internalProperty()
  amount: ethers.BigNumber;

  @internalProperty()
  account: string;

  @internalProperty()
  balanceOk: boolean = false;

  @internalProperty()
  approvedOk: boolean = false;

  @internalProperty()
  wrapping: boolean = false;

  @internalProperty()
  approving: boolean = false;

  @internalProperty()
  buying: boolean = false;

  @query("#amount-input")
  priceInput: any;

  provider: ethers.providers.JsonRpcProvider;
  signer: ethers.providers.JsonRpcSigner | undefined;
  token: ethers.Contract;
  dai: ethers.Contract;

  daiBalance: ethers.BigNumber;
  daiApproved: ethers.BigNumber;
  uprBalance: ethers.BigNumber;

  async firstUpdated() {
    this.provider = new ethers.providers.JsonRpcProvider(
      "https://xdai.poanetwork.dev"
    );
    this.signer = undefined;
    this.token = new ethers.Contract(CONTRACT_ADDRESS, abiUpr, this.provider);

    await this.refreshSupply();

    this.loading = false;
    await this.updateComplete;

    this.priceInput.focus();
  }

  async refreshSupply() {
    this.supply = (await this.token.totalSupply()).sub(
      await this.token.initSupply()
    );
    const step1 = ethers.utils.parseUnits("10000000");
    const step2 = ethers.utils.parseUnits("20000000");

    this.available1 = this.supply.lte(step1)
      ? step1.sub(this.supply)
      : ethers.BigNumber.from("0");

    this.available2 = this.supply.lte(step2)
      ? this.supply.gt(step1)
        ? step2.sub(this.supply)
        : step2.sub(step1)
      : ethers.BigNumber.from("0");
  }

  async connect() {
    await window["ethereum"].enable();
    this.provider = new ethers.providers.Web3Provider(window["ethereum"]);
    this.signer = this.provider.getSigner();
    this.token = new ethers.Contract(CONTRACT_ADDRESS, abiUpr, this.signer);
    this.dai = new ethers.Contract(DAI_ADDRESS, abiDai, this.signer);

    this.checkAccount();
    setInterval(() => this.checkAccount(), 2500);
  }

  async checkAccount() {
    const newAccount = await this.signer.getAddress();
    if (this.account !== newAccount) {
      this.account = newAccount;
      await this.refreshDai();
      this.requestUpdate();
    }
  }

  async refreshDai() {
    if (this.signer === undefined) return;

    this.daiBalance = await this.dai.balanceOf(this.account);
    this.daiApproved = await this.dai.allowance(this.account, CONTRACT_ADDRESS);
    this.uprBalance = await this.token.balanceOf(this.account);

    if (this.price !== undefined) {
      this.balanceOk = this.daiBalance.gte(this.price);
      this.approvedOk = this.daiApproved.gte(this.price);
    } else {
    }
  }

  async wrap() {
    this.wrapping = true;
    const amount = this.price.sub(this.daiBalance);
    try {
      const tx = await this.dai.deposit({ value: amount.toString() });
      const receipt = await tx.wait();
      await this.refreshDai();
    } catch (e) {
      console.log("error wrapping", e);
    }
    this.wrapping = false;
  }

  async approve() {
    this.approving = true;
    try {
      const tx = await this.dai.approve(CONTRACT_ADDRESS, this.price);
      const receipt = await tx.wait();
      await this.refreshDai();
    } catch (e) {
      console.log("error approving", e);
    }
    this.approving = false;
  }

  async buy() {
    this.buying = true;
    try {
      const tx = await this.token.mint(this.account, this.amount);
      const receipt = await tx.wait();
      await this.refreshDai();
      this.priceInput.value = 0;
      await this.updatePrice();
    } catch (e) {
      console.log("error buying", e);
    }
    this.buying = false;
  }

  async updatePrice() {
    this.amount = ethers.utils.parseUnits(this.priceInput.value);
    const result = await this.token.mintCost(this.amount.toString());
    this.price = result[0];
    this.refreshDai();
  }

  render() {
    if (this.loading) {
      return html`<mwc-circular-progress
        indeterminate
        density="-6"
      ></mwc-circular-progress>`;
    }

    const shouldConnect = this.signer === undefined;
    const shouldWrap =
      this.signer !== undefined && this.price !== undefined && !this.balanceOk;
    const shouldApprove =
      this.signer !== undefined &&
      this.price !== undefined &&
      this.balanceOk &&
      !this.approvedOk;
    const shouldBuy =
      this.signer !== undefined &&
      this.price !== undefined &&
      this.amount.toString() !== "0" &&
      this.balanceOk &&
      this.approvedOk;

    return html`<div class="container">
      <h1>UPR Credits</h1>
      <table class="table">
        <tr>
          <th class="">price</th>
          <th class="">available</th>
        </tr>
        <tr>
          <td class="amount">0.01 DAI</td>
          <td class="available">
            ${ethers.utils.commify(ethers.utils.formatEther(this.available1))}
          </td>
        </tr>
        <tr>
          <td class="amount">0.1 DAI</td>
          <td class="available">
            ${ethers.utils.commify(ethers.utils.formatEther(this.available2))}
          </td>
        </tr>
        <tr>
          <td class="amount">1 DAI</td>
          <td class="available">infinite</td>
        </tr>
      </table>
      <div class="mg-top row">
        <div class="input-and-label">
          <label>Buy</label>
          <input
            @input=${() => this.updatePrice()}
            id="amount-input"
            class="input"
            placeholder="amount"
            type="number"
          />
        </div>

        <div class="input-and-label">
          <label>Price (DAI)</label>
          <input
            class="input"
            disabled
            value=${ethers.utils.commify(
              this.price !== undefined
                ? ethers.utils.formatEther(this.price)
                : "0"
            )}
          />
        </div>
      </div>
      <div class="mg-top column">
        <div class="button-row">
          <mwc-button
            unelevated
            ?disabled=${!shouldConnect}
            @click=${() => this.connect()}
            >${shouldConnect
              ? "connect"
              : `connected (${this.account.substr(0, 8)}...)`}
          </mwc-button>
        </div>

        <div class="button-row">
          <mwc-button
            unelevated
            ?disabled=${!shouldWrap}
            @click=${() => this.wrap()}
          >
            ${`wrap xDAI${
              shouldWrap
                ? ` (${ethers.utils.commify(
                    ethers.utils.formatEther(this.price.sub(this.daiBalance))
                  )})`
                : ""
            }`}
          </mwc-button>
          ${this.wrapping
            ? html`<mwc-circular-progress
                indeterminate
                density="-6"
              ></mwc-circular-progress>`
            : ""}
        </div>

        <div class="button-row">
          <mwc-button
            unelevated
            ?disabled=${!shouldApprove}
            @click=${() => this.approve()}
            >approve WXDAI
          </mwc-button>
          ${this.approving
            ? html`<mwc-circular-progress
                indeterminate
                density="-6"
              ></mwc-circular-progress>`
            : ""}
        </div>

        <div class="button-row">
          <mwc-button
            unelevated
            ?disabled=${!shouldBuy}
            @click=${() => this.buy()}
            >buy${shouldBuy
              ? ` (${ethers.utils.commify(
                  ethers.utils.formatEther(this.amount)
                )})`
              : ""}
          </mwc-button>
          ${this.buying
            ? html`<mwc-circular-progress
                indeterminate
                density="-6"
              ></mwc-circular-progress>`
            : ""}
        </div>
        ${this.signer !== undefined
          ? html`<div class="input-and-label">
              <label>UPR balance</label>
              <input
                disabled
                class="input"
                type="number"
                value=${ethers.utils.commify(
                  ethers.utils.formatEther(this.uprBalance)
                )}
              />
            </div>`
          : ""}
      </div>
    </div>`;
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
          --mdc-theme-primary: #1564bf;
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

        .input-and-label {
          display: flex;
          flex-direction: column;
          font-size: 12px;
          font-weight: bold;
        }

        .amount {
          text-align: right;
          width: 110px;
        }

        .available {
          text-align: right;
          width: 110px;
        }

        th {
          text-align: center;
        }

        td {
          padding: 8px;
          background-color: rgba(0, 0, 0, 0.12);
        }

        .mg-top {
          margin-top: 24px;
        }

        .input {
          padding: 3px 12px;
          margin-right: 6px;
          height: 30px;
        }

        .button-row {
          position: relative;
          margin-bottom: 12px;
        }

        .button-row mwc-circular-progress {
          position: absolute;
          right: -36px;
          top: 6px;
        }

        .button-row mwc-button {
          width: 260px;
        }
      `,
    ];
  }
}
