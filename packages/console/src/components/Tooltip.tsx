import { useState } from "react";
import { ITooltip, Tooltip as ReactTooltip } from 'react-tooltip'

function Tooltip (options: ITooltip) {
    return (
        <ReactTooltip
            noArrow={true}
            className="p-8 rounded-2xl bg-white/80 backdrop-blur-tooltip border border-hot-red"
            variant="light"
            disableStyleInjection={'core'}
            {...options} />
    );
}

export default Tooltip