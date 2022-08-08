import { Construct } from 'constructs'

import * as events from 'aws-cdk-lib/aws-events'

export interface EventsProps {
    readonly prefix: string
}

export class Events extends Construct {
    public readonly bus: events.EventBus

    constructor(scope: Construct, id: string, props: EventsProps) {
        super(scope, id)

        this.bus = new events.EventBus(this, 'bus', {
            eventBusName: `${props.prefix}-eventbus`
        })

        // TODO:  Write events to CloudWatch
    }
}