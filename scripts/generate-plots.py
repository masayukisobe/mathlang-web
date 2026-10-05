"""Render selected recorded CSV values; this script performs no product execution.
Optional regeneration dependency: matplotlib==3.10.6. Normal website builds use
these saved SVG assets and need Node.js only.
"""
from pathlib import Path
import csv
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT = Path(__file__).resolve().parents[1]
with (ROOT / 'public/results/v1/d04-series.csv').open(newline='') as handle:
    rows = list(csv.DictReader(handle))
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':16,'svg.fonttype':'none','svg.hashsalt':'mathlang-selected-series-v1'})
def plot(filename, names, limits):
    fig, ax = plt.subplots(figsize=(6.6,3.4), dpi=100)
    fig.patch.set_facecolor('#fcfdf9'); ax.set_facecolor('#fcfdf9')
    for name, color, style, marker in names:
        selected = [r for r in rows if r['series'] == name]
        assert len(selected) == 13
        ax.plot([float(r['time_s']) for r in selected], [float(r['displacement_m']) for r in selected], color=color, linestyle=style, linewidth=1.7, marker=marker, markersize=4.5, markerfacecolor='#fcfdf9', markeredgewidth=1.2)
    ax.set_xlim(0,3); ax.set_ylim(*limits)
    ax.set_xticks([0,1,2,3]); ax.set_yticks([v for v in [-.25,0,.25,.5,.75,1] if limits[0] <= v <= limits[1]])
    ax.set_xlabel('Time / s', loc='right', color='#56695e')
    ax.set_ylabel('Displacement / m', color='#56695e')
    ax.tick_params(axis='both', colors='#56695e', length=0, labelsize=14, pad=7)
    ax.grid(axis='y', color='#d5ded3', linewidth=.7)
    ax.set_axisbelow(True)
    for spine in ax.spines.values(): spine.set_visible(False)
    fig.subplots_adjust(left=.19, right=.98, bottom=.21, top=.96)
    fig.savefig(ROOT / 'src/assets' / filename, format='svg', metadata={'Date':None,'Creator':'MathLang web; Matplotlib 3.10.6'})
    target = ROOT / 'src/assets' / filename
    target.write_text('\n'.join(line.rstrip() for line in target.read_text().splitlines()) + '\n')
    plt.close(fig)
plot('identified-response.svg', [('identified-response','#173f34','-',None),('synthetic-observation','#173f34','None','o')], (-.3,1.05))
plot('candidate-response.svg', [('from-returned-fit','#173f34','-',None),('alternative-stiffer','#786016','--',None)], (0,1.05))
