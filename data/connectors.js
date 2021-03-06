import Sequelize from 'sequelize';

import { get as httpsGet } from 'https';

import dotenv from 'dotenv';

dotenv.config();

export class IrsDbConnector {

  constructor() {
    this.db = new Sequelize(process.env.PG_DATABASE, process.env.PG_USER, process.env.PG_PASSWORD, {
      host: process.env.PG_HOST,
      port: process.env.PG_PORT,
      dialect: 'postgres',
      dialectOptions: {
        ssl: (process.env.PG_SSLMODE === 'require'),
      },
    });

    this.IrsDbModel = this.db.define('irsdb', {
      source: Sequelize.STRING(50),
      org: Sequelize.BIGINT,
      ein: Sequelize.STRING(50),
      subseccd: Sequelize.STRING(50),
      pdf: Sequelize.STRING(255),
      filing_type: Sequelize.STRING(50),
      start_year: Sequelize.INTEGER,
      end_year: Sequelize.INTEGER,
      irs_year: Sequelize.INTEGER,
      filing_date: Sequelize.STRING(25),
      tax_period: Sequelize.STRING(25),
      contributions_and_grants: Sequelize.BIGINT,
      program_service_revenue: Sequelize.BIGINT,
      investment_income: Sequelize.BIGINT,
      other_revenue: Sequelize.BIGINT,
      total_revenue: Sequelize.BIGINT,
      grants_paid: Sequelize.BIGINT,
      benefits_paid: Sequelize.BIGINT,
      compensation: Sequelize.BIGINT,
      fundraising_fees: Sequelize.BIGINT,
      total_fundraising_expenses: Sequelize.BIGINT,
      other_expenses: Sequelize.BIGINT,
      total_expenses: Sequelize.BIGINT,
      revenue_less_expenses: Sequelize.BIGINT,
      total_assets: Sequelize.BIGINT,
      total_liabilities: Sequelize.BIGINT,
      net_assets: Sequelize.BIGINT,
      data: Sequelize.JSONB,
    }, {
      freezeTableName: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      tableName: 'combined',
    });
  }

  get(ein) {
    return this.db.models.irsdb.find({ where: { ein } });
  }

  forms990(ein, limit, offset) {
    return this.db.models.irsdb.findAll({
      where: {
        ein,
      },
      limit,
      offset,
    });
  }

}

export class LedgerConnector {

  /**
   * @param {Number} ein
   * @returns {Promise}
   */
  grants(ein, limit, offset) {
    return new Promise((resolve, reject) => {
      const url = `${process.env.LEDGER_API_URL}/grants.json?filters[ein]=${ein}&limit=${limit}&offset=${offset}`;
      const req = httpsGet(url, (res) => {
        if (res.statusCode < 200 || res.statusCode > 299) {
          reject(new Error(`HTTP error: ${res.statusCode}`));
        }

        const body = [];

        res.on('data', chunk => body.push(chunk));
        res.on('end', () => {
          const data = JSON.parse(body.join(''));

          resolve(data.grants.map((grant) => {
            return {
              ein,
              id: grant.id,
              funder: {
                id: grant.field_funder.target_id,
                name: grant.field_funder.name,
              },
              recipient: {
                id: grant.field_recipient.target_id,
                name: grant.field_recipient.name,
              },
              start: grant.field_start_date,
              end: grant.field_end_date,
              amount: grant.field_funded_amount,
            };
          }));
        });
      });

      req.on('error', err => reject(err));
    });
  }

  /**
   * @param {Number} ein
   * @returns {Promise}
   */
  organizations(ein, limit, offset) {
    return new Promise((resolve, reject) => {
      const url = `${process.env.LEDGER_API_URL}/orgs.json?filters[ein]=${ein}&limit=${limit}&offset=${offset}`;
      const req = httpsGet(url, (res) => {
        if (res.statusCode < 200 || res.statusCode > 299) {
          reject(new Error(`HTTP error: ${res.statusCode}`));
        }

        const body = [];

        res.on('data', chunk => body.push(chunk));
        res.on('end', () => {
          const data = JSON.parse(body.join(''));

          resolve(data.orgs.map(orgTemplate));
        });
      });

      req.on('error', err => reject(err));
    });
  }


  /**
   * @param {Number} ein
   * @returns {Promise}
   */
  newsArticles(ein, limit, offset) {
    return new Promise((resolve, reject) => {
      const url = `${process.env.LEDGER_API_URL}/newsarticles.json?filters[ein]=${ein}&limit=${limit}&offset=${offset}`;
      console.log(url);
      const req = httpsGet(url, (res) => {
        if (res.statusCode < 200 || res.statusCode > 299) {
          reject(new Error(`HTTP error: ${res.statusCode}`));
        }

        const body = [];

        res.on('data', chunk => body.push(chunk));
        res.on('end', () => {
          const data = JSON.parse(body.join(''));
          resolve(data.newsarticles.map((article) => {
            return {
              ein,
              id: article.id,
              desc: article.field_news_desc,
              date: article.field_news_date,
              link: article.field_news_link,
              relatedOrgIds: article.field_news_org.map((el) => el.target_id),
            };
          }));
        });
      });

      req.on('error', err => reject(err));
    });
  }

  /**
   * @param {Number} ein
   * @returns {Promise}
   */
  organization(id) {
    return new Promise((resolve, reject) => {
      const url = `${process.env.LEDGER_API_URL}/orgs/${id}.json`;
      console.log(url);
      const req = httpsGet(url, (res) => {
        if (res.statusCode < 200 || res.statusCode > 299) {
          reject(new Error(`HTTP error: ${res.statusCode}`));
        }

        const body = [];

        res.on('data', chunk => body.push(chunk));
        res.on('end', () => {
          resolve(orgTemplate(JSON.parse(body.join(''))));
        });
      });

      req.on('error', err => reject(err));
    });
  }

  ntee(id) {
    return new Promise((resolve, reject) => {
      const url = `${process.env.LEDGER_API_URL}/orgs/${id}.json`;
      console.log(url);
      const req = httpsGet(url, (res) => {
        if (res.statusCode < 200 || res.statusCode > 299) {
          reject(new Error(`HTTP error: ${res.statusCode}`));
        }

        const body = [];

        res.on('data', chunk => body.push(chunk));
        res.on('end', () => {
          const org = JSON.parse(body.join(''));
          resolve({
            id: org.id,
            ein: org.field_ein,
            name: org.title,
            description: org.body ? org.body.und[0].value : null,
            start: org.org_grants_datestart,
            end: org.org_grants_dateend,
            received: org.org_grants_received,
            funded: org.org_grants_funded,
            stateCorpId: org.field_state_corp_id ? org.field_state_corp_id.value : null,
          });
        });
      });

      req.on('error', err => reject(err));
    });
  }

}

function orgTemplate(org) {
  return {
    id: org.id,
    ein: org.field_ein,
    name: org.title,
    description: org.body ? org.body.und[0].value : null,
    start: org.org_grants_datestart,
    end: org.org_grants_dateend,
    received: org.org_grants_received,
    funded: org.org_grants_funded,
    nteeIds: org.field_ntee ? Object.keys(org.field_ntee.und) : [],
    stateCorpId: org.field_state_corp_id ? org.field_state_corp_id.value : null,
  };
}
