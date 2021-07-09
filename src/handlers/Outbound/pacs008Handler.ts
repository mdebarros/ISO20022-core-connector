/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2021 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Steven Oderayi - steven.oderayi@modusbox.com                     *
 **************************************************************************/

import { ICamt003, IErrorInformation, IPacs008 } from '../../interfaces';
import { postQuotes } from '../../requests/Outbound';
import { fspiopErrorToCamt004Error, pacs008ToPostQuotesBody, partiesByIdResponseToCamt004 } from '../../transformers';
import { ApiContext } from '../../types';


const handleError = (error: Error | IErrorInformation, ctx: ApiContext) => {
    ctx.state.logger.error(error);
    if((error as IErrorInformation).errorCode) {
        const originalMsgId = (ctx.request.body as ICamt003).Document.GetAcct.MsgHdr.MsgId;
        const { body, status } = fspiopErrorToCamt004Error(error as IErrorInformation, originalMsgId);
        ctx.response.type = 'application/xml';
        ctx.response.body = body;
        ctx.response.status = status;
    } else {
        ctx.response.body = '';
        ctx.response.type = 'text/html';
        ctx.response.status = 500;
    }
};

export default async (ctx: ApiContext): Promise<void> => {
    try {
        // TODO: Run pacs.008 XSD validation or apply at OpenAPI validation level
        // convert pacs.008 to POST /quotes and send
        const postQuotesBody = pacs008ToPostQuotesBody(ctx.request.body as IPacs008);
        let res = await postQuotes(postQuotesBody);
        ctx.state.logger.log(JSON.stringify(res.data));
        if(res.data.body.errorInformation) {
            handleError(res.data.body.errorInformation, ctx);
            return;
        }

        // convert POST /quotes response to POST /tranfers request and send
        // if no error is received, we send PUT /transfers/transferId to accept quote and execute transfer
        res = {} as any;
        if(res.data.body.errorInformation) {
            handleError(res.data.body.errorInformation, ctx);
            return;
        }


        // convert response to pacs.002 and respond
        ctx.response.type = 'application/xml';
        ctx.response.body = partiesByIdResponseToCamt004(res.data);
        ctx.response.status = 200;
    } catch (e) {
        handleError(e, ctx);
    }
};
